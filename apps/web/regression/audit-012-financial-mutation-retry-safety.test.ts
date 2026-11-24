import { renderHook } from "@testing-library/react";
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";
import React, { type ReactNode } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
} from "@tanstack/react-query";
import { usePool } from "@/hooks/usePool";
import { useInvoiceActions } from "@/hooks/useInvoices";
import { useWalletStore } from "@/store/wallet";
import { PoolClient, InvoiceClient } from "@trusttrove/sdk";
import {
  MUTATION_RETRY_DISABLED,
  isRetryableTransientError,
} from "@/lib/retry";

/**
 * Regression lock-in for issue #639 — "add bounded retry with backoff" — and
 * for the rejection of the first attempt at it (PR #713).
 *
 * #639 asks for automatic bounded retries on transient failures. PR #713
 * implemented that by spreading a retry policy across every mutation,
 * including `deposit`, `withdraw`, `fundInvoice`, `repayInvoice` and
 * `createInvoice`, and was rejected:
 *
 *   "A timeout or network error can occur after a transaction is submitted, so
 *    automatically rerunning the mutation can submit a second money-moving
 *    transaction. [...] Please restrict automatic retry to operations with
 *    verified idempotency, or confirm the original transaction outcome by hash
 *    / use a stable idempotency key before resubmission; add a test for an
 *    ambiguous post-submit network failure."
 *
 * This file is that test. Each money-moving mutation is driven through its
 * real hook against the real `@tanstack/react-query` runtime, with the SDK
 * client and `fetch` mocked so that the call is *recorded as submitted* and
 * only then fails with a transient, connectivity-shaped error — the ambiguous
 * case. Every assertion is a count: exactly ONE submission per user action.
 *
 * None of these mutations may be retried automatically, because:
 *   - the on-chain ones build, sign and submit a Stellar transaction, so a
 *     lost response does not prove the transaction failed (see below), and
 *   - `createInvoice` POSTs to an API with no idempotency-key support
 *     (`grep -ri idempoten` over this repository matches only unrelated
 *     indexer and store tests), so a replayed POST creates a duplicate
 *     invoice.
 *
 * The hooks currently pass no `retry` option, so react-query's mutation
 * default of `retry: 0` applies (query-core `mutation.js`:
 * `retry: this.options.retry ?? 0`). That is the correct behaviour but it is
 * an *absence*, which a future contributor could innocently overwrite while
 * "finally implementing #639". These cases pin it down: adding
 * `retry: 2`/`retry: true` to any mutation below turns this file red.
 *
 * `MUTATION_RETRY_DISABLED` in `@/lib/retry` is the named, documented
 * counterpart of the same decision, and is asserted at the bottom.
 */

vi.mock("@trusttrove/sdk", () => ({
  PoolClient: vi.fn(function () {}),
  InvoiceClient: vi.fn(function () {}),
}));

// Allowance approval is a separate signing step and not what is under test;
// stubbing it keeps each case to a single money-moving submission.
vi.mock("@/hooks/useTokenAllowance", () => ({
  useTokenAllowance: () => ({
    ensureAllowance: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@/lib/toast", () => ({
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
}));

const WALLET_ADDRESS = "GTESTADDRESS000000000000000000000000000000000000000000";
const INVOICE_ID = "inv-639";

/**
 * A transient, connectivity-shaped failure of the kind that arrives *after* a
 * transaction has gone out: the request was sent, the reply never came back.
 * `@/lib/retry` classifies this as retryable, which is exactly what makes the
 * test meaningful — the error is in the retryable class and the mutation is
 * still not retried, because the *operation* is not safe to repeat.
 */
function lostResponseError(): Error {
  return new Error("network timeout waiting for transaction result");
}

/**
 * The real react-query runtime, with mutation options left at library
 * defaults. Nothing here disables mutation retries: if a hook asked for them,
 * they would happen. Queries are capped only to keep unrelated read failures
 * from adding noise.
 */
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, refetchOnMount: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return { wrapper, queryClient };
}

/** Captures the rejection of a mutation without failing the test on it. */
async function expectRejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  throw new Error("expected the mutation to reject, but it resolved");
}

let fetchMock: Mock;
let invoicePostCount: number;
let activeClients: { queryClient: QueryClient }[];

function jsonResponse(body: unknown, status = 200): Response {
  const text = JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
    json: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
  useWalletStore.getState().disconnect();
  invoicePostCount = 0;
  activeClients = [];

  // Routes every HTTP call the hooks make. `POST /invoices` is the one
  // money-moving HTTP path (`createInvoice` -> `apiFetch`) and answers 503,
  // the exact status #639 is about; reads answer benignly so they cannot
  // distort the submission counts.
  fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();

    if (method === "POST" && url.includes("/invoices")) {
      invoicePostCount += 1;
      return jsonResponse(
        { error: "Service Temporarily Unavailable. Please try again later." },
        503,
      );
    }
    return jsonResponse({});
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  for (const { queryClient } of activeClients) {
    queryClient.clear();
  }
  vi.unstubAllGlobals();
});

function renderWithWallet<T>(hook: () => T) {
  useWalletStore.getState().connect(WALLET_ADDRESS, "testnet");
  const { wrapper, queryClient } = createWrapper();
  activeClients.push({ queryClient });
  return renderHook(hook, { wrapper });
}

describe("Regression: financial mutations never retry automatically (#639)", () => {
  describe("ambiguous post-submit network failure — on-chain pool mutations", () => {
    it("submits deposit exactly once when the response to the submission is lost", async () => {
      // The mock stands in for the signed-and-submitted transaction: it
      // records the submission, and only then does the connection die. A lost
      // response DOES NOT PROVE THE TRANSACTION FAILED — the ledger may have
      // applied the deposit already. Re-running the mutation would build and
      // submit a second deposit and move the user's money twice, which is
      // precisely why PR #713 was rejected.
      const submissions: bigint[] = [];
      const mockDeposit = vi.fn(async (_from: string, amount: bigint) => {
        submissions.push(amount);
        throw lostResponseError();
      });
      vi.mocked(PoolClient).mockImplementation(function () {
        return { deposit: mockDeposit };
      } as unknown as typeof PoolClient);

      const { result } = renderWithWallet(() => usePool());

      const error = await expectRejection(
        result.current.deposit({ amount: 100n, asset: "USDC" }),
      );

      // The failure is in the retryable class...
      expect(isRetryableTransientError(error)).toBe(true);
      // ...and is still submitted only once. This is the duplicate-payment
      // guard: one user action, one money-moving submission.
      expect(mockDeposit).toHaveBeenCalledTimes(1);
      expect(submissions).toEqual([100n]);
    });

    it("submits withdraw exactly once when the response to the submission is lost", async () => {
      // Same ambiguity on the way out: the shares may already have been
      // burned and the funds released when the response is lost, so a retry
      // could withdraw twice.
      const submissions: bigint[] = [];
      const mockWithdraw = vi.fn(async (_from: string, shares: bigint) => {
        submissions.push(shares);
        throw lostResponseError();
      });
      vi.mocked(PoolClient).mockImplementation(function () {
        return { withdraw: mockWithdraw };
      } as unknown as typeof PoolClient);

      const { result } = renderWithWallet(() => usePool());

      const error = await expectRejection(
        result.current.withdraw({ shares: 50n }),
      );

      expect(isRetryableTransientError(error)).toBe(true);
      expect(mockWithdraw).toHaveBeenCalledTimes(1);
      expect(submissions).toEqual([50n]);
    });
  });

  describe("ambiguous post-submit network failure — on-chain invoice mutations", () => {
    it("submits fundInvoice exactly once when the response to the submission is lost", async () => {
      // fundInvoice moves pool capital to the issuer. A lost response leaves
      // the outcome unknown; resubmitting could fund the same invoice twice.
      const submissions: string[] = [];
      const mockFundInvoice = vi.fn(async (invoiceId: string) => {
        submissions.push(invoiceId);
        throw lostResponseError();
      });
      vi.mocked(PoolClient).mockImplementation(function () {
        return { fundInvoice: mockFundInvoice };
      } as unknown as typeof PoolClient);

      const { result } = renderWithWallet(() => useInvoiceActions());

      const error = await expectRejection(
        result.current.fundInvoice({ invoiceId: INVOICE_ID }),
      );

      expect(isRetryableTransientError(error)).toBe(true);
      expect(mockFundInvoice).toHaveBeenCalledTimes(1);
      expect(submissions).toEqual([INVOICE_ID]);
    });

    it("submits repayInvoice exactly once when the response to the submission is lost", async () => {
      // Repayment transfers the full face value from the buyer. Double
      // submission would take the money twice.
      const submissions: string[] = [];
      const mockRepay = vi.fn(async (invoiceId: string) => {
        submissions.push(invoiceId);
        throw lostResponseError();
      });
      const mockGet = vi.fn().mockResolvedValue({ faceValue: 1000n });
      vi.mocked(InvoiceClient).mockImplementation(function () {
        return { get: mockGet, repay: mockRepay };
      } as unknown as typeof InvoiceClient);

      const { result } = renderWithWallet(() => useInvoiceActions());

      const error = await expectRejection(
        result.current.repayInvoice({ invoiceId: INVOICE_ID }),
      );

      expect(isRetryableTransientError(error)).toBe(true);
      expect(mockRepay).toHaveBeenCalledTimes(1);
      expect(submissions).toEqual([INVOICE_ID]);
    });
  });

  describe("createInvoice — the HTTP money-moving path", () => {
    it("issues exactly one POST /invoices for a 503, with no automatic replay", async () => {
      // `createInvoice` is the only mutation that goes through `apiFetch`, and
      // 503 is the status #639 cites. It is still not retried: the backend has
      // no idempotency-key support, so a replayed POST creates a DUPLICATE
      // INVOICE. A 503 also does not prove the request was not processed.
      const { result } = renderWithWallet(() => useInvoiceActions());

      await expectRejection(
        result.current.createInvoice({
          buyer: WALLET_ADDRESS,
          faceValue: "1000",
          dueDate: 1_900_000_000,
          asset: "USDC",
        }),
      );

      expect(invoicePostCount).toBe(1);

      const invoicePosts = fetchMock.mock.calls.filter(
        ([input, init]) =>
          String(input).includes("/invoices") &&
          String((init as RequestInit | undefined)?.method).toUpperCase() ===
            "POST",
      );
      expect(invoicePosts).toHaveLength(1);
    });

    it("still issues exactly one POST /invoices for a 504", async () => {
      // 504 is the other status `apiFetch` describes as temporary, and is the
      // more dangerous of the two: a gateway timeout is ambiguous about
      // whether the invoice was created.
      fetchMock.mockImplementation(
        async (input: unknown, init?: RequestInit) => {
          const url = String(input);
          const method = (init?.method ?? "GET").toUpperCase();
          if (method === "POST" && url.includes("/invoices")) {
            invoicePostCount += 1;
            return jsonResponse({ error: "Gateway Timeout" }, 504);
          }
          return jsonResponse({});
        },
      );

      const { result } = renderWithWallet(() => useInvoiceActions());

      await expectRejection(
        result.current.createInvoice({
          buyer: WALLET_ADDRESS,
          faceValue: "1000",
          dueDate: 1_900_000_000,
          asset: "USDC",
        }),
      );

      expect(invoicePostCount).toBe(1);
    });
  });

  describe("positive control: the harness really does detect a retry", () => {
    it("demonstrates that retry: 2 submits the same deposit three times", async () => {
      // Without this case the "exactly once" assertions above could pass
      // vacuously — e.g. if the mock or the wrapper swallowed retries. Here
      // the SAME ambiguous failure is fed to a mutation shaped exactly like
      // `usePool`'s deposit but carrying the `retry: 2` that PR #713 added.
      // It submits the money-moving call THREE times for ONE user action.
      //
      // This is the concrete hazard the maintainer rejected, reproduced as an
      // executable demonstration rather than prose: if anyone adds `retry` to
      // a real mutation, the counts above become these counts and this file
      // turns red.
      const submissions: bigint[] = [];
      const mockDeposit = vi.fn(async (_from: string, amount: bigint) => {
        submissions.push(amount);
        throw lostResponseError();
      });

      const { wrapper, queryClient } = createWrapper();
      activeClients.push({ queryClient });

      const { result } = renderHook(
        () =>
          useMutation({
            mutationFn: ({ amount }: { amount: bigint }) =>
              mockDeposit(WALLET_ADDRESS, amount),
            retry: 2,
            retryDelay: 0,
          }),
        { wrapper },
      );

      await expectRejection(result.current.mutateAsync({ amount: 100n }));

      expect(mockDeposit).toHaveBeenCalledTimes(3);
      expect(submissions).toEqual([100n, 100n, 100n]);

      // And with the policy constant in place, the very same mutation submits
      // once. `MUTATION_RETRY_DISABLED` is the fix, not a no-op.
      mockDeposit.mockClear();
      submissions.length = 0;

      const guarded = renderHook(
        () =>
          useMutation({
            mutationFn: ({ amount }: { amount: bigint }) =>
              mockDeposit(WALLET_ADDRESS, amount),
            retry: MUTATION_RETRY_DISABLED,
            retryDelay: 0,
          }),
        { wrapper },
      );

      await expectRejection(
        guarded.result.current.mutateAsync({ amount: 100n }),
      );

      expect(mockDeposit).toHaveBeenCalledTimes(1);
      expect(submissions).toEqual([100n]);
    });
  });

  describe("the policy module encodes the same decision", () => {
    it("MUTATION_RETRY_DISABLED is 0", () => {
      expect(MUTATION_RETRY_DISABLED).toBe(0);
    });

    it("matches react-query's own mutation default, so wiring it changes nothing", () => {
      // query-core: `retry: this.options.retry ?? 0`. Passing the constant is
      // documentation, not a behaviour change — which is why it is safe to
      // wire in everywhere.
      expect(MUTATION_RETRY_DISABLED).toBe(0);
    });

    it("never treats a deliberate abort as retryable", () => {
      // A user cancelling must not be converted into a retry (which could
      // resubmit) nor reported as a server outage.
      const aborted = new DOMException(
        "The operation was aborted.",
        "AbortError",
      );
      expect(isRetryableTransientError(aborted)).toBe(false);

      const apiAborted = Object.assign(new Error("aborted"), {
        kind: "aborted" as const,
        status: null,
      });
      expect(isRetryableTransientError(apiAborted)).toBe(false);
    });
  });
});
