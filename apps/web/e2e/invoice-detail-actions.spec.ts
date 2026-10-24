import { expect, type Page } from "@playwright/test";
import {
  Address,
  Keypair,
  Networks,
  SorobanDataBuilder,
  StrKey,
  TransactionBuilder,
  nativeToScVal,
  xdr,
  type Operation,
  type Transaction,
} from "@stellar/stellar-sdk";
import { test } from "./fixtures/freighter";

/**
 * Buyer-side and terminal actions on `/invoice/[invoiceId]`
 * (`InvoiceDetailClient` + `useInvoiceDetailActions`), driven end to end:
 * action button -> `ConfirmationDialog` -> `useInvoiceActions` mutation ->
 * `@trusttrove/sdk` `InvoiceClient` -> Soroban RPC -> `TransactionPending`
 * -> `useInvoice().refetch()`.
 *
 * The SDK validates every address and decodes every RPC response as XDR, so
 * unlike `sme-issuer-flow.spec.ts` (whose write is expected to fail on the
 * missing contract id) these mocks have to be ledger-shaped: real strkeys, a
 * real account entry, real simulation/transaction XDR.
 */

// Distinct, valid Stellar identities. The shared fixture's `MOCK_ADDRESS` is
// not a valid strkey, which `new Address(...)` and `server.getAccount(...)`
// reject before anything reaches the RPC.
const BUYER = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 1)).publicKey();
const ISSUER = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 2)).publicKey();
const INVOICE_CONTRACT_ID = StrKey.encodeContract(Buffer.alloc(32, 3));
const INVOICE_ID = "b".repeat(64);
const FACE_VALUE = 10_000_000_000n; // 1,000.00 USDC in stroops
const DAY_SECONDS = 24 * 60 * 60;

type MockInvoiceStatus =
  "Funded" | "Active" | "Confirmed" | "Repaid" | "Defaulted";

interface MockInvoice {
  status: MockInvoiceStatus;
  issuer: string;
  buyer: string;
  faceValue: bigint;
  /** Unix seconds. */
  dueDate: number;
}

/** Status each successful contract call moves the invoice to. */
const NEXT_STATUS: Record<string, MockInvoiceStatus> = {
  confirm_delivery: "Confirmed",
  repay: "Repaid",
  trigger_default: "Defaulted",
};

/**
 * Due dates are relative to the real clock the page also reads
 * (`InvoiceDetailClient` compares `invoice.dueDate` with `Date.now()`), so a
 * whole week either side keeps `isOverdue` unambiguous.
 */
function dueInDays(days: number): number {
  return Math.floor(Date.now() / 1000) + days * DAY_SECONDS;
}

function buildInvoice(overrides: Partial<MockInvoice> = {}): MockInvoice {
  return {
    status: "Active",
    issuer: ISSUER,
    buyer: BUYER,
    faceValue: FACE_VALUE,
    dueDate: dueInDays(7),
    ...overrides,
  };
}

/** Indexer (`GET /invoices/:id`) representation of the invoice. */
function toApiInvoice(invoice: MockInvoice) {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: INVOICE_ID,
    issuer: invoice.issuer,
    buyer: invoice.buyer,
    face_value: invoice.faceValue.toString(),
    asset: "USDC",
    discount_bps: 200,
    funded_amount: "9800000000",
    due_date: invoice.dueDate,
    status: invoice.status,
    created_at: now - 20 * DAY_SECONDS,
    funded_at: now - 15 * DAY_SECONDS,
    shipped_at: invoice.status === "Funded" ? null : now - 10 * DAY_SECONDS,
    issuer_confirmed: false,
    buyer_confirmed: invoice.status !== "Funded" && invoice.status !== "Active",
    repaid_at: invoice.status === "Repaid" ? now : null,
  };
}

/** On-chain (`InvoiceClient.get`) representation of the invoice. */
function toContractInvoice(invoice: MockInvoice): xdr.ScVal {
  const api = toApiInvoice(invoice);
  const u64 = (value: number | null) =>
    nativeToScVal(value ?? 0, { type: "u64" });
  const entries: Array<[string, xdr.ScVal]> = [
    ["asset", xdr.ScVal.scvSymbol("USDC")],
    ["buyer", new Address(api.buyer).toScVal()],
    ["buyer_confirmed", xdr.ScVal.scvBool(api.buyer_confirmed)],
    ["created_at", u64(api.created_at)],
    ["discount_bps", nativeToScVal(api.discount_bps, { type: "u32" })],
    ["due_date", u64(api.due_date)],
    ["face_value", nativeToScVal(invoice.faceValue, { type: "i128" })],
    [
      "funded_amount",
      nativeToScVal(BigInt(api.funded_amount), { type: "i128" }),
    ],
    ["funded_at", u64(api.funded_at)],
    ["id", xdr.ScVal.scvBytes(Buffer.from(INVOICE_ID, "hex"))],
    ["issuer", new Address(api.issuer).toScVal()],
    ["issuer_confirmed", xdr.ScVal.scvBool(api.issuer_confirmed)],
    ["repaid_at", u64(api.repaid_at)],
    ["shipped_at", u64(api.shipped_at)],
    ["status", xdr.ScVal.scvSymbol(invoice.status)],
  ];
  return xdr.ScVal.scvMap(
    entries.map(
      ([key, val]) =>
        new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol(key), val }),
    ),
  );
}

function decodeTransaction(envelopeXdr: string): Transaction {
  return TransactionBuilder.fromXDR(
    envelopeXdr,
    Networks.TESTNET,
  ) as Transaction;
}

/** Contract function a single-operation Soroban transaction invokes. */
function invokedMethod(tx: Transaction): string {
  const op = tx.operations[0] as Operation.InvokeHostFunction;
  return op.func.invokeContract().functionName().toString();
}

/**
 * Builds an XDR union from its switch value. stellar-base's typings declare
 * static `0()` factories for these unions that the runtime does not define;
 * the runtime constructor takes `(switch, value)`.
 */
function unionArm<T>(union: { prototype: T }, arm: number, value?: unknown) {
  const Union = union as unknown as new (arm: number, value?: unknown) => T;
  return new Union(arm, value);
}

function accountEntryXdr(accountId: string): string {
  return xdr.LedgerEntryData.account(
    new xdr.AccountEntry({
      accountId: Keypair.fromPublicKey(accountId).xdrAccountId(),
      balance: xdr.Int64.fromString("100000000000"),
      seqNum: xdr.Int64.fromString("4294967296"),
      numSubEntries: 0,
      inflationDest: null,
      flags: 0,
      homeDomain: "",
      thresholds: Buffer.from([1, 0, 0, 0]),
      signers: [],
      ext: unionArm(xdr.AccountEntryExt, 0),
    }),
  ).toXDR("base64");
}

function transactionResultXdr(result: xdr.TransactionResultResult): string {
  return new xdr.TransactionResult({
    feeCharged: xdr.Int64.fromString("100"),
    result,
    ext: unionArm(xdr.TransactionResultExt, 0),
  }).toXDR("base64");
}

const LATEST_LEDGER = 1000;

interface Deferred {
  promise: Promise<void>;
  release: () => void;
}

function deferred(): Deferred {
  let release = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

/**
 * Stateful ledger behind both the indexer API and the Soroban RPC mocks.
 *
 * `GET /invoices/:id` keeps returning the initial status until a submitted
 * transaction is confirmed by `getTransaction`; from then on it returns the
 * status that contract call leads to, which is what the hook's `refetch()`
 * picks up.
 */
async function mockInvoiceLedger(page: Page, invoice: MockInvoice) {
  const state = { invoice: { ...invoice } };
  /** Contract methods whose transactions reached `sendTransaction`. */
  const submissions: string[] = [];
  /** Contract methods simulated (reads and pre-submission writes). */
  const simulations: string[] = [];
  const pending = new Map<string, { envelopeXdr: string; method: string }>();
  let rejectSubmissions = false;
  let submissionGate: Promise<void> | null = null;

  await page.route("**/horizon-testnet.stellar.org/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: BUYER,
        account_id: BUYER,
        sequence: "4294967296",
        subentry_count: 0,
        balances: [],
      }),
    });
  });

  await page.route("**/soroban-testnet.stellar.org/**", async (route) => {
    const body = route.request().postDataJSON() as {
      id?: number;
      method?: string;
      params?: { transaction?: string; hash?: string; keys?: string[] };
    };
    const id = body?.id ?? 1;
    const reply = (result: unknown) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ jsonrpc: "2.0", id, result }),
      });

    switch (body?.method) {
      case "getLedgerEntries": {
        // `server.getAccount()` reads the signer's account entry.
        const entries = (body.params?.keys ?? []).flatMap((keyXdr) => {
          const key = xdr.LedgerKey.fromXDR(keyXdr, "base64");
          if (key.switch() !== xdr.LedgerEntryType.account()) return [];
          const accountId = StrKey.encodeEd25519PublicKey(
            key.account().accountId().ed25519(),
          );
          return [
            {
              key: keyXdr,
              xdr: accountEntryXdr(accountId),
              lastModifiedLedgerSeq: LATEST_LEDGER - 1,
            },
          ];
        });
        await reply({ entries, latestLedger: LATEST_LEDGER });
        return;
      }

      case "simulateTransaction": {
        const method = invokedMethod(
          decodeTransaction(body.params?.transaction ?? ""),
        );
        simulations.push(method);
        const retval =
          method === "get"
            ? toContractInvoice(state.invoice)
            : method === "allowance"
              ? // Enough allowance that `ensureAllowance` skips the approve.
                nativeToScVal(FACE_VALUE * 10n, { type: "i128" })
              : xdr.ScVal.scvVoid();
        await reply({
          latestLedger: LATEST_LEDGER,
          minResourceFee: "100",
          transactionData: new SorobanDataBuilder().build().toXDR("base64"),
          results: [{ auth: [], xdr: retval.toXDR("base64") }],
          cost: { cpuInsns: "0", memBytes: "0" },
        });
        return;
      }

      case "sendTransaction": {
        const envelopeXdr = body.params?.transaction ?? "";
        const tx = decodeTransaction(envelopeXdr);
        const method = invokedMethod(tx);
        const hash = tx.hash().toString("hex");
        submissions.push(method);
        if (submissionGate) await submissionGate;

        const latest = {
          latestLedger: LATEST_LEDGER,
          latestLedgerCloseTime: String(Math.floor(Date.now() / 1000)),
        };
        if (rejectSubmissions) {
          await reply({
            status: "ERROR",
            hash,
            ...latest,
            errorResultXdr: transactionResultXdr(
              xdr.TransactionResultResult.txBadAuth(),
            ),
          });
          return;
        }
        pending.set(hash, { envelopeXdr, method });
        await reply({ status: "PENDING", hash, ...latest });
        return;
      }

      case "getTransaction": {
        const hash = body.params?.hash ?? "";
        const tx = pending.get(hash);
        if (!tx) {
          await reply({
            status: "NOT_FOUND",
            latestLedger: LATEST_LEDGER,
            latestLedgerCloseTime: String(Math.floor(Date.now() / 1000)),
          });
          return;
        }
        const nextStatus = NEXT_STATUS[tx.method];
        if (nextStatus) state.invoice.status = nextStatus;
        await reply({
          status: "SUCCESS",
          txHash: hash,
          latestLedger: LATEST_LEDGER,
          latestLedgerCloseTime: String(Math.floor(Date.now() / 1000)),
          ledger: LATEST_LEDGER,
          createdAt: Math.floor(Date.now() / 1000),
          applicationOrder: 1,
          feeBump: false,
          envelopeXdr: tx.envelopeXdr,
          resultXdr: transactionResultXdr(
            xdr.TransactionResultResult.txSuccess([]),
          ),
          resultMetaXdr: unionArm(xdr.TransactionMeta, 0, []).toXDR("base64"),
        });
        return;
      }

      case "getLatestLedger":
        await reply({
          id: "0".repeat(64),
          protocolVersion: 22,
          sequence: LATEST_LEDGER,
        });
        return;

      default:
        await reply({});
    }
  });

  await page.route(`**/invoices/${INVOICE_ID}`, async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(toApiInvoice(state.invoice)),
    });
  });

  return {
    submissions,
    simulations,
    /** Make `sendTransaction` answer with an `ERROR` status. */
    rejectSubmissions: () => {
      rejectSubmissions = true;
    },
    /**
     * Hold `sendTransaction` until the returned callback is called, so a
     * spec can observe the in-flight state deterministically.
     */
    holdSubmissions: () => {
      const gate = deferred();
      submissionGate = gate.promise;
      return gate.release;
    },
  };
}

/**
 * Points the shared Freighter mock at a valid account and gives the browser
 * bundle an invoice contract id.
 *
 * `hooks/useInvoices.ts` reads `process.env.NEXT_PUBLIC_INVOICE_CONTRACT_ID`.
 * When the dev server has no such variable, Next leaves that expression to be
 * resolved at runtime through its `process` polyfill, which defers to an
 * existing `window.process` (next/dist/build/polyfills/process.js). Seeding
 * one here lets this spec submit transactions without changing the server's
 * environment, which other specs rely on being contract-less. If the variable
 * is configured, Next inlines it instead; the RPC mocks never check the
 * contract id, so they serve either.
 *
 * The polyfill hands this object to every module that touches `process`, so
 * it carries the same surface as the browser `process` shim it replaces.
 */
async function seedWallet(page: Page, address: string) {
  await page.addInitScript(
    ({ walletAddress, contractId }) => {
      const win = window as any;
      win.freighter = {
        ...win.freighter,
        requestAccess: () => Promise.resolve(walletAddress),
        getPublicKey: () => Promise.resolve(walletAddress),
      };

      const noop = () => {};
      win.process = {
        env: { NEXT_PUBLIC_INVOICE_CONTRACT_ID: contractId },
        browser: true,
        title: "browser",
        argv: [],
        version: "",
        versions: {},
        nextTick: (fn: (...args: unknown[]) => void, ...args: unknown[]) =>
          queueMicrotask(() => fn(...args)),
        on: noop,
        once: noop,
        off: noop,
        addListener: noop,
        removeListener: noop,
        removeAllListeners: noop,
        emit: noop,
        listeners: () => [],
        cwd: () => "/",
        umask: () => 0,
      };
    },
    { walletAddress: address, contractId: INVOICE_CONTRACT_ID },
  );
}

async function openInvoiceAs(
  page: Page,
  address: string,
  role: "issuer" | "buyer",
) {
  await seedWallet(page, address);
  await page.goto(`/invoice/${INVOICE_ID}`);
  await expect(
    page.getByRole("heading", { name: /Invoice Audit Ledger/i }),
  ).toBeVisible();

  // The Navbar is the first navigation landmark; the breadcrumb is the second.
  const nav = page.getByRole("navigation").first();
  await nav.getByRole("button", { name: /Connect Wallet/i }).click();
  await expect(
    nav.getByText(`${address.slice(0, 6)}...${address.slice(-4)}`, {
      exact: true,
    }),
  ).toBeVisible({ timeout: 15000 });

  await page.getByRole("combobox", { name: /Active role/i }).selectOption(role);
}

function statusBadge(page: Page, status: MockInvoiceStatus) {
  return page.getByRole("status", { name: `Invoice status: ${status}` });
}

function actionButton(page: Page, name: RegExp) {
  return page.getByRole("button", { name });
}

/**
 * A submission is several RPC round trips plus the SDK chunks, which the dev
 * server compiles on first use. The existing specs allow 15s for wallet and
 * chain steps too.
 */
const SUBMISSION_TIMEOUT = { timeout: 15000 };

const CONFIRM_DELIVERY = /^Confirm Delivery$/i;
const REPAY_INVOICE = /^Repay Invoice$/i;
const DEFAULT_INVOICE = /^Default Invoice$/i;

function confirmationDialog(page: Page, label: string) {
  return page.getByRole("dialog", { name: `Confirm ${label}` });
}

function pendingModal(page: Page) {
  return page.getByRole("dialog", { name: "Transaction Pending" });
}

test.describe("Invoice detail - buyer actions", () => {
  test("buyer confirms delivery on an Active invoice", async ({ page }) => {
    const ledger = await mockInvoiceLedger(page, buildInvoice());
    await openInvoiceAs(page, BUYER, "buyer");
    await expect(statusBadge(page, "Active")).toBeVisible();

    await actionButton(page, CONFIRM_DELIVERY).click();
    const dialog = confirmationDialog(page, "Confirm Delivery");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "CONFIRM", exact: true }).click();
    await expect(dialog).toBeHidden();

    await expect(pendingModal(page)).toContainText("Confirming delivery...");

    await expect(statusBadge(page, "Confirmed")).toBeVisible(
      SUBMISSION_TIMEOUT,
    );
    expect(ledger.submissions).toEqual(["confirm_delivery"]);
  });

  test("buyer repays a Confirmed invoice", async ({ page }) => {
    const ledger = await mockInvoiceLedger(
      page,
      buildInvoice({ status: "Confirmed" }),
    );
    await openInvoiceAs(page, BUYER, "buyer");
    await expect(statusBadge(page, "Confirmed")).toBeVisible();

    await actionButton(page, REPAY_INVOICE).click();
    const dialog = confirmationDialog(page, "Repay Invoice");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "CONFIRM", exact: true }).click();

    await expect(pendingModal(page)).toContainText("Repaying invoice...");

    await expect(statusBadge(page, "Repaid")).toBeVisible(SUBMISSION_TIMEOUT);
    // The on-chain read and the allowance check precede the one submission.
    expect(ledger.simulations).toEqual(
      expect.arrayContaining(["get", "allowance", "repay"]),
    );
    expect(ledger.submissions).toEqual(["repay"]);
  });
});

test.describe("Invoice detail - default gating", () => {
  test("an overdue Confirmed invoice offers DEFAULT INVOICE and defaults", async ({
    page,
  }) => {
    const ledger = await mockInvoiceLedger(
      page,
      buildInvoice({ status: "Confirmed", dueDate: dueInDays(-7) }),
    );
    await openInvoiceAs(page, BUYER, "buyer");
    await expect(page.getByText("OVERDUE", { exact: true })).toBeVisible();

    await expect(actionButton(page, REPAY_INVOICE)).toBeVisible();
    await actionButton(page, DEFAULT_INVOICE).click();
    const dialog = confirmationDialog(page, "Default Invoice");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "CONFIRM", exact: true }).click();

    await expect(pendingModal(page)).toContainText("Defaulting invoice...");
    await expect(statusBadge(page, "Defaulted")).toBeVisible(
      SUBMISSION_TIMEOUT,
    );
    expect(ledger.submissions).toEqual(["trigger_default"]);
  });

  test("a Confirmed invoice that is not yet due offers no DEFAULT INVOICE", async ({
    page,
  }) => {
    await mockInvoiceLedger(
      page,
      buildInvoice({ status: "Confirmed", dueDate: dueInDays(7) }),
    );
    await openInvoiceAs(page, BUYER, "buyer");
    await expect(page.getByText(/days remaining/i)).toBeVisible();

    // REPAY INVOICE renders, so the action panel itself is there.
    await expect(actionButton(page, REPAY_INVOICE)).toBeVisible();
    await expect(actionButton(page, DEFAULT_INVOICE)).toHaveCount(0);
  });
});

test.describe("Invoice detail - cancellation and failures", () => {
  test("cancelling the confirmation dialog submits nothing", async ({
    page,
  }) => {
    const ledger = await mockInvoiceLedger(page, buildInvoice());
    await openInvoiceAs(page, BUYER, "buyer");

    await actionButton(page, CONFIRM_DELIVERY).click();
    const dialog = confirmationDialog(page, "Confirm Delivery");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();

    await expect(dialog).toBeHidden();
    await expect(pendingModal(page)).toHaveCount(0);
    await expect(statusBadge(page, "Active")).toBeVisible();
    await expect(actionButton(page, CONFIRM_DELIVERY)).toBeEnabled();
    // Only the cancelled action matters: with a registry contract configured
    // (as in CI), the page also simulates read-only profile lookups.
    expect(ledger.simulations).not.toContain("confirm_delivery");
    expect(ledger.submissions).toEqual([]);
  });

  test("a rejected submission shows the error and closes the pending modal", async ({
    page,
  }) => {
    const ledger = await mockInvoiceLedger(page, buildInvoice());
    ledger.rejectSubmissions();
    const releaseSubmission = ledger.holdSubmissions();
    await openInvoiceAs(page, BUYER, "buyer");

    await actionButton(page, CONFIRM_DELIVERY).click();
    await confirmationDialog(page, "Confirm Delivery")
      .getByRole("button", { name: "CONFIRM", exact: true })
      .click();

    // Held at sendTransaction: the pending modal is up and the action locked.
    await expect(pendingModal(page)).toBeVisible();
    await expect
      .poll(() => ledger.submissions, SUBMISSION_TIMEOUT)
      .toEqual(["confirm_delivery"]);
    releaseSubmission();

    // Filtered by text: Next's route announcer is an (empty) `role="alert"`
    // region too.
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: /Send failed for confirm_delivery/ }),
    ).toBeVisible(SUBMISSION_TIMEOUT);
    await expect(pendingModal(page)).toHaveCount(0);
    await expect(statusBadge(page, "Active")).toBeVisible();
    await expect(actionButton(page, CONFIRM_DELIVERY)).toBeEnabled();
  });
});

test.describe("Invoice detail - role gating", () => {
  test("the issuer sees no buyer actions on an Active invoice", async ({
    page,
  }) => {
    await mockInvoiceLedger(page, buildInvoice());
    await openInvoiceAs(page, ISSUER, "issuer");
    await expect(statusBadge(page, "Active")).toBeVisible();

    await expect(
      page.getByRole("heading", { name: /Available Action/i }),
    ).toHaveCount(0);
    for (const name of [CONFIRM_DELIVERY, REPAY_INVOICE, DEFAULT_INVOICE]) {
      await expect(actionButton(page, name)).toHaveCount(0);
    }

    // Control: the same page offers the buyer action once the role is buyer,
    // so the absence above is the gating and not a page that never loaded.
    await page
      .getByRole("combobox", { name: /Active role/i })
      .selectOption("buyer");
    await expect(actionButton(page, CONFIRM_DELIVERY)).toBeVisible();
  });
});
