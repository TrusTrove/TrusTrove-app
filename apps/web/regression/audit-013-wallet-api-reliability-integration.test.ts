/**
 * Regression: cross-cutting interactions between issues #636, #637, #638
 * and #639.
 *
 * The individual fixes are covered by `audit-010` (wallet query gating),
 * `audit-011` (auth token lifecycle), `lib/api.test.ts` (timeouts and
 * cancellation) and `audit-012` (financial mutation retry safety). This file
 * covers the seams *between* them, which no single-issue test can see:
 *
 *  - #638 x #639 — `lib/retry.ts` classifies errors structurally and
 *    deliberately does not import `lib/api.ts`. That decoupling is only
 *    correct while the `ApiError` shape `apiFetch` actually throws still
 *    matches what the classifier duck-types. These tests build real errors by
 *    driving the real `apiFetch` and assert both modules agree.
 *  - #637 x #638 — the retry loop added for #638/#639 re-attempts a request.
 *    The Bearer token must be re-read per attempt, so a token cleared by
 *    logout can never be resurrected on a later attempt.
 *  - #636 x #637 — disconnecting the wallet must leave no credential behind
 *    for a subsequent request.
 *  - #638 x #639 — a cancellation (what react-query raises when a gated or
 *    unmounted query aborts) must never be retried.
 *
 * Uses the real wallet store, the real `apiFetch` and the real retry policy;
 * only `global.fetch` is mocked. No network, no wallet, no funds.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiFetch, ApiError, isTransientApiError } from "@/lib/api";
import {
  isRetryableTransientError,
  retryTransientQuery,
  MUTATION_RETRY_DISABLED,
} from "@/lib/retry";
import { useWalletStore } from "@/store/wallet";

const mockFetch = vi.fn();

/** A JSON `Response` double good enough for `apiFetch`. */
function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

/** An error `Response` double whose body is plain text. */
function errorResponse(status: number, text = ""): Response {
  return {
    ok: false,
    status,
    json: async () => ({}),
    text: async () => text,
  } as unknown as Response;
}

/** Captures the rejection of `promise`, failing if it resolves. */
async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  throw new Error("expected the request to reject, but it resolved");
}

/** The `Authorization` header of the nth `fetch` call, or null when absent. */
function authHeaderOfCall(index: number): string | null {
  const init = mockFetch.mock.calls[index]?.[1] as RequestInit | undefined;
  const headers = init?.headers;
  if (!(headers instanceof Headers)) {
    throw new Error("expected apiFetch to pass a Headers instance");
  }
  return headers.get("Authorization");
}

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockReset();
  localStorage.clear();
  useWalletStore.setState({
    address: null,
    connected: false,
    network: null,
    token: null,
    role: "issuer",
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("#638 x #639: the errors apiFetch throws are the errors retry.ts classifies", () => {
  it("agrees that a 503 is transient", async () => {
    mockFetch.mockResolvedValue(errorResponse(503, "overloaded"));

    const err = await rejection(apiFetch("/stats", { retry: { attempts: 0 } }));

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).kind).toBe("http");
    expect((err as ApiError).status).toBe(503);
    // Both classifiers must reach the same verdict on the same real error.
    expect(isTransientApiError(err)).toBe(true);
    expect(isRetryableTransientError(err)).toBe(true);
    expect(retryTransientQuery(0, err)).toBe(true);
  });

  it("agrees that a 400 is permanent", async () => {
    mockFetch.mockResolvedValue(errorResponse(400, "bad request"));

    const err = await rejection(apiFetch("/stats"));

    expect((err as ApiError).status).toBe(400);
    expect(isTransientApiError(err)).toBe(false);
    expect(isRetryableTransientError(err)).toBe(false);
    expect(retryTransientQuery(0, err)).toBe(false);
    // A permanent failure must not be re-attempted by the transport either.
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("agrees that a timeout is transient", async () => {
    vi.useFakeTimers();
    mockFetch.mockImplementation(() => new Promise(() => {}));

    const pending = rejection(
      apiFetch("/stats", { timeoutMs: 1000, retry: { attempts: 0 } }),
    );
    await vi.advanceTimersByTimeAsync(1000);
    const err = await pending;

    expect((err as ApiError).kind).toBe("timeout");
    expect(isTransientApiError(err)).toBe(true);
    expect(isRetryableTransientError(err)).toBe(true);
  });

  it("agrees that a caller cancellation is NOT retryable", async () => {
    // This is the error react-query raises when a query is unmounted or
    // otherwise cancelled (#636/#638). Retrying it would defeat the
    // cancellation and reopen the request storm #638 set out to stop.
    const controller = new AbortController();
    controller.abort();
    mockFetch.mockResolvedValue(jsonResponse({}));

    const err = await rejection(
      apiFetch("/stats", { signal: controller.signal }),
    );

    expect((err as ApiError).kind).toBe("aborted");
    expect(isTransientApiError(err)).toBe(false);
    expect(isRetryableTransientError(err)).toBe(false);
    expect(retryTransientQuery(0, err)).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("#637 x #638: the retry loop cannot resurrect a cleared token", () => {
  it("re-reads the Bearer token on every attempt, so a logout mid-retry drops it", async () => {
    useWalletStore.getState().connect("GTEST", "testnet");
    useWalletStore.getState().setToken("jwt-first-attempt-only");

    mockFetch
      .mockImplementationOnce(async () => {
        // The session ends while the first attempt is in flight — exactly what
        // `logout()` does (#637).
        useWalletStore.getState().setToken(null);
        useWalletStore.getState().disconnect();
        return errorResponse(503, "overloaded");
      })
      .mockImplementationOnce(async () => jsonResponse({ ok: true }));

    await apiFetch("/stats", { retry: { baseDelayMs: 0 } });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(authHeaderOfCall(0)).toBe("Bearer jwt-first-attempt-only");
    // The retry must NOT carry the token the logout just cleared.
    expect(authHeaderOfCall(1)).toBeNull();
  });

  it("sends no Authorization header on any attempt once disconnected", async () => {
    useWalletStore.getState().connect("GTEST", "testnet");
    useWalletStore.getState().setToken("jwt-to-be-cleared");
    useWalletStore.getState().disconnect();

    mockFetch
      .mockResolvedValueOnce(errorResponse(503, "overloaded"))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    await apiFetch("/stats", { retry: { baseDelayMs: 0 } });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(authHeaderOfCall(0)).toBeNull();
    expect(authHeaderOfCall(1)).toBeNull();
  });
});

describe("#638 x #639: method safety outranks error classification", () => {
  it("does not retry a POST whose 503 IS classified transient", async () => {
    mockFetch.mockResolvedValue(errorResponse(503, "overloaded"));

    const err = await rejection(
      apiFetch("/invoices", {
        method: "POST",
        body: JSON.stringify({ buyer: "GBUYER" }),
        retry: { baseDelayMs: 0 },
      }),
    );

    // The error is in the retryable class...
    expect(isRetryableTransientError(err)).toBe(true);
    // ...and the request is still sent exactly once, because replaying a
    // non-idempotent POST would create a duplicate invoice (#639).
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("keeps the mutation retry guard at zero", () => {
    expect(MUTATION_RETRY_DISABLED).toBe(0);
  });
});
