import { expect, type Page } from "@playwright/test";
import { test } from "./fixtures/freighter";

const MOCK_WALLET = "GBMOCKWALLETADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
const MOCK_BUYER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const MOCK_INVOICE_ID =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

type MockInvoiceStatus = "Created" | "Listed" | "Funded" | "Active";

interface MockInvoiceState {
  status: MockInvoiceStatus;
  discountBps: number;
  dueDate: number;
}

// `InvoiceForm` rejects due dates less than 7 days out, so the mock's date
// must clear that floor. The ISO string is built from local date parts (not
// `toISOString`) so it always names the day the calendar will offer.
function futureDueDate(daysAhead = 9): { input: string; timestamp: number } {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  date.setHours(12, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    input: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    timestamp: Math.floor(date.getTime() / 1000),
  };
}

function buildRawInvoice(state: MockInvoiceState) {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: MOCK_INVOICE_ID,
    issuer: MOCK_WALLET,
    buyer: MOCK_BUYER,
    face_value: "10000000000",
    asset: "USDC",
    discount_bps: state.discountBps,
    funded_amount:
      state.status === "Funded" || state.status === "Active"
        ? "9500000000"
        : "0",
    due_date: state.dueDate,
    status: state.status,
    created_at: now,
    funded_at:
      state.status === "Funded" || state.status === "Active" ? now : null,
    shipped_at: state.status === "Active" ? now : null,
    issuer_confirmed: false,
    buyer_confirmed: false,
    repaid_at: null,
  };
}

/**
 * `InvoiceTable` renders `truncateAddress(invoice.id)` (first six characters,
 * an ellipsis, then the last four — `lib/format.ts`), so the row is matched on
 * that rendered form. For this 64-character id that is `aaaaaa...aaaa`.
 */
function displayedInvoiceId(id = MOCK_INVOICE_ID) {
  return `${id.slice(0, 6)}...${id.slice(-4)}`;
}

function invoiceRow(page: Page) {
  return page.getByRole("row").filter({ hasText: displayedInvoiceId() });
}

async function setupStellarNetworkMocks(page: Page) {
  await page.route("**/horizon-testnet.stellar.org/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: MOCK_WALLET,
        account_id: MOCK_WALLET,
        sequence: "123456789",
        subentry_count: 0,
        balances: [],
      }),
    });
  });

  await page.route("**/soroban-testnet.stellar.org/**", async (route) => {
    const body = route.request().postDataJSON() as {
      id?: number;
      method?: string;
      params?: { transaction?: string };
    };
    const id = body?.id ?? 1;
    const method = body?.method ?? "";

    if (method === "getTransaction") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id,
          result: {
            status: "SUCCESS",
            txHash: "mock-onchain-tx-hash",
            ledger: 12345,
            createdAt: new Date().toISOString(),
          },
        }),
      });
      return;
    }

    if (method === "sendTransaction") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id,
          result: {
            status: "PENDING",
            hash: "mock-onchain-tx-hash",
          },
        }),
      });
      return;
    }

    if (method === "prepareTransaction") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id,
          result: {
            transaction: body?.params?.transaction ?? "",
            minResourceFee: "100",
          },
        }),
      });
      return;
    }

    if (method === "simulateTransaction") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id,
          result: {
            transactionData: "",
            minResourceFee: "100",
            results: [{ auth: [], xdr: "" }],
            cost: { cpuInsns: "0", memBytes: "0" },
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id,
        result: {},
      }),
    });
  });
}

async function setupIssuerApiMocks(page: Page) {
  const dueDate = futureDueDate();
  const invoiceState: MockInvoiceState = {
    status: "Created",
    discountBps: 0,
    dueDate: dueDate.timestamp,
  };
  let invoiceCreated = false;

  await page.route("**/events**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  await page.route("**/invoices**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "POST" && url.pathname.endsWith("/invoices")) {
      invoiceCreated = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          invoice_id: MOCK_INVOICE_ID,
          transaction_hash: "mock-create-tx-hash",
          status: "Created",
        }),
      });
      return;
    }

    if (request.method() === "PATCH") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    if (url.pathname.endsWith(`/invoices/${MOCK_INVOICE_ID}`)) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildRawInvoice(invoiceState)),
      });
      return;
    }

    if (url.pathname.endsWith("/invoices")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: invoiceCreated ? [buildRawInvoice(invoiceState)] : [],
          total: invoiceCreated ? 1 : 0,
          page: 1,
          limit: 20,
          totalPages: invoiceCreated ? 1 : 0,
        }),
      });
      return;
    }

    await route.continue();
  });

  return {
    dueDate,
    markListed: () => {
      invoiceState.status = "Listed";
      invoiceState.discountBps = 200;
    },
    markFunded: () => {
      invoiceState.status = "Funded";
    },
    markShipped: () => {
      invoiceState.status = "Active";
    },
  };
}

async function connectAsIssuer(page: Page) {
  await page.goto("/dashboard");

  // Scoped to the Navbar: the dashboard body renders no connect control, but
  // the gate pages do.
  const connectBtn = page
    .getByRole("navigation")
    .getByRole("button", { name: /Connect Wallet/i });
  if (await connectBtn.isVisible()) {
    await connectBtn.click();
  }

  await expect(
    page.getByRole("navigation").getByText("GBMOCK...XXXX", { exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    page.getByRole("heading", { name: /SME Financing Dashboard/i }),
  ).toBeVisible();
  await expect(page.getByText(/ROLE:\s*ISSUER/i)).toBeVisible();
}

/**
 * `InvoiceForm`/`InvoiceCard` gate every write behind `useProfile().isVerified`,
 * which reads the registry contract. No registry contract is configured in this
 * environment, so the queries settle unverified and the cache is seeded
 * directly through the `window.__reactQueryClient` handle published by
 * `app/providers.tsx` — the same mechanism the profile specs use.
 *
 * The seeded cache must survive into the test (a `page.reload()` drops it, and
 * the reload would restore the unverified state).
 */
async function seedVerifiedIssuer(page: Page) {
  await page.evaluate((walletAddress) => {
    const queryClient = (
      window as Window & {
        __reactQueryClient?: {
          setQueryData: (key: unknown[], value: unknown) => void;
        };
      }
    ).__reactQueryClient;
    if (!queryClient) throw new Error("React Query client not exposed");

    queryClient.setQueryData(["isVerified", walletAddress], true);
    queryClient.setQueryData(["profile", walletAddress], {
      address: walletAddress,
      role: "issuer",
      verified: true,
      registeredAt: Math.floor(Date.now() / 1000),
      metadata: {},
    });
  }, MOCK_WALLET);

  await expect(
    page.getByRole("button", { name: /Create Invoice/i }),
  ).toBeEnabled({ timeout: 15000 });
}

async function selectDueDate(page: Page, isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const monthName = new Date(Date.UTC(year, month - 1, 1)).toLocaleString(
    "en-US",
    { month: "long", timeZone: "UTC" },
  );

  // The trigger is labelled by the form's "Due Date" <label> (#998).
  await page.getByRole("button", { name: /Due Date/i }).click();

  // react-day-picker labels each day button with its full date, e.g.
  // "Saturday, October 17th, 2026" (the ordinal suffix varies). The calendar
  // opens on the current month, so advance it when the due date lands later.
  // Match only an ordinal suffix after the day: "\w*" would let day 2 also
  // match the 20th-29th.
  const calendar = page
    .getByRole("dialog")
    .filter({ has: page.getByRole("grid") });
  const dayButton = calendar.getByRole("button", {
    name: new RegExp(`${monthName} ${day}(?:st|nd|rd|th)?, ${year}`, "i"),
  });

  for (let hops = 0; hops < 3 && !(await dayButton.isVisible()); hops += 1) {
    await page.getByRole("button", { name: /Go to the Next Month/i }).click();
  }

  await dayButton.click();
}

test.describe("SME Issuer Flow - Happy Path", () => {
  test("the create-invoice dialog does not scroll horizontally on phones", async ({
    page,
  }) => {
    await setupStellarNetworkMocks(page);
    await setupIssuerApiMocks(page);
    await connectAsIssuer(page);
    await seedVerifiedIssuer(page);

    await page.getByRole("button", { name: /Create Invoice/i }).click();
    const dialog = page.getByRole("dialog", { name: /Create Invoice/i });
    await expect(dialog).toBeVisible();

    // #999: the date trigger must fit its column and the modal must not gain a
    // horizontal scrollbar at the two narrowest common phone widths.
    for (const width of [320, 375]) {
      await page.setViewportSize({ width, height: 800 });

      const overflow = await dialog.evaluate((element) => {
        const panel = element.querySelector<HTMLElement>(".overflow-y-auto");
        return {
          dialog: element.scrollWidth - element.clientWidth,
          panel: panel ? panel.scrollWidth - panel.clientWidth : 0,
        };
      });

      expect(overflow.dialog).toBeLessThanOrEqual(0);
      expect(overflow.panel).toBeLessThanOrEqual(0);

      const triggerFits = await dialog
        .getByRole("button", { name: /Due Date/i })
        .evaluate((element) => element.scrollWidth <= element.clientWidth + 1);
      expect(triggerFits).toBe(true);
    }
  });

  test("creates an invoice, lists it, and selects it from the ledger", async ({
    page,
  }) => {
    await setupStellarNetworkMocks(page);
    const invoiceMocks = await setupIssuerApiMocks(page);
    await connectAsIssuer(page);
    await seedVerifiedIssuer(page);

    await page.getByRole("button", { name: /Create Invoice/i }).click();
    const dialog = page.getByRole("dialog", { name: /Create Invoice/i });
    await expect(dialog).toBeVisible();

    await page.getByPlaceholder(/Stellar Public Key/i).fill(MOCK_BUYER);
    await page.getByPlaceholder(/50,000\.00/i).fill("1000");
    await selectDueDate(page, invoiceMocks.dueDate.input);

    await page
      .getByRole("checkbox", {
        name: /List for immediate LP financing at creation/i,
      })
      .uncheck();

    await dialog
      .getByRole("button", { name: /Review Financing Terms/i })
      .click();
    // Scoped to the open dialog: the page header's own "Create Invoice"
    // button stays in the DOM behind it.
    await dialog.getByRole("button", { name: /Create Invoice/i }).click();

    await expect(page.getByText(/Invoice Created/i)).toBeVisible({
      timeout: 15000,
    });

    // The created invoice appears in the ledger under its truncated id, and
    // selecting that row loads it into the management console.
    await invoiceRow(page).click();

    await expect(
      page.getByRole("button", { name: /Configure financing terms/i }),
    ).toBeVisible();
  });

  // FIXME: CI builds with the testnet contract IDs, so the "Contract ID is
  // required" path is never reached. Tracked in https://github.com/TrusTrove/TrusTrove-app/issues/1175
  test.fixme("reports a failed listing when no invoice contract is configured", async ({
    page,
  }) => {
    await setupStellarNetworkMocks(page);
    const invoiceMocks = await setupIssuerApiMocks(page);
    await connectAsIssuer(page);
    await seedVerifiedIssuer(page);

    await page.getByRole("button", { name: /Create Invoice/i }).click();
    const dialog = page.getByRole("dialog", { name: /Create Invoice/i });
    await page.getByPlaceholder(/Stellar Public Key/i).fill(MOCK_BUYER);
    await page.getByPlaceholder(/50,000\.00/i).fill("1000");
    await selectDueDate(page, invoiceMocks.dueDate.input);
    await page
      .getByRole("checkbox", {
        name: /List for immediate LP financing at creation/i,
      })
      .uncheck();
    await dialog
      .getByRole("button", { name: /Review Financing Terms/i })
      .click();
    await dialog.getByRole("button", { name: /Create Invoice/i }).click();
    await expect(page.getByText(/Invoice Created/i)).toBeVisible({
      timeout: 15000,
    });

    await invoiceRow(page).click();
    await page
      .getByRole("button", { name: /Configure financing terms/i })
      .click();

    // Listing is an on-chain write (`useInvoiceActions` -> InvoiceClient).
    // Without NEXT_PUBLIC_INVOICE_CONTRACT_ID the SDK client cannot be
    // constructed, and the failure is surfaced instead of a false success.
    await page.getByLabel(/Discount Basis Points/i).fill("200");
    await page.getByRole("button", { name: /List Terms/i }).click();

    await expect(page.getByText(/Listing Failed/i)).toBeVisible({
      timeout: 15000,
    });
    // The SDK error surfaces both inline in the card and in the toast.
    await expect(
      page.getByText(/Contract ID is required/i).first(),
    ).toBeVisible();
  });
});

test.describe("SME Issuer Flow - Secondary Flows", () => {
  test("Wallet disconnection from SME dashboard", async ({ page }) => {
    await setupIssuerApiMocks(page);
    await connectAsIssuer(page);

    await page
      .getByRole("navigation")
      .getByRole("button", { name: /Disconnect wallet/i })
      .click();

    await expect(
      page
        .getByRole("navigation")
        .getByRole("button", { name: /Connect Wallet/i }),
    ).toBeVisible({ timeout: 10000 });
  });

  test("Frontend error states", async ({ page }) => {
    await page.goto("/this-route-does-not-exist");
    await expect(
      page.getByText(/Page not found/i).or(page.getByText(/404/i)),
    ).toBeVisible();
  });
});
