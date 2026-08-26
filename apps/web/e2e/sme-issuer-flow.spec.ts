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

function tomorrowDueDate(): { input: string; timestamp: number } {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(12, 0, 0, 0);
  return {
    input: date.toISOString().split("T")[0],
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
  const dueDate = tomorrowDueDate();
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

  const connectBtn = page.getByRole("button", { name: /Connect Wallet/i });
  if (await connectBtn.isVisible()) {
    await connectBtn.click();
  }

  await expect(page.getByText(/GBMOCK\.\.\.XXXX/i)).toBeVisible({
    timeout: 15000,
  });
  await expect(
    page.getByRole("heading", { name: /SME Financing Dashboard/i }),
  ).toBeVisible();
  await expect(page.getByText(/ROLE:\s*ISSUER/i)).toBeVisible();
}

async function seedVerifiedIssuer(page: Page) {
  await page.evaluate(
    ({ walletAddress }) => {
      const queryClient = (
        window as Window & {
          __reactQueryClient?: {
            setQueryData: (key: unknown[], value: unknown) => void;
          };
        }
      ).__reactQueryClient;

      queryClient?.setQueryData(["isVerified", walletAddress], true);
      queryClient?.setQueryData(["profile", walletAddress], {
        address: walletAddress,
        role: "Issuer",
        verified: true,
        registeredAt: Math.floor(Date.now() / 1000),
      });
    },
    { walletAddress: MOCK_WALLET },
  );

  await page.reload();
  await connectAsIssuer(page);
}

async function selectDueDate(page: Page, isoDate: string) {
  const day = Number(isoDate.split("-")[2]);
  await page.getByRole("button", { name: /Select due date/i }).click();
  await page
    .getByRole("gridcell", { name: String(day), exact: true })
    .first()
    .click();
}

test.describe("SME Issuer Flow - Happy Path", () => {
  test("Connect, create, list, and ship an invoice", async ({ page }) => {
    await setupStellarNetworkMocks(page);
    const invoiceMocks = await setupIssuerApiMocks(page);
    await connectAsIssuer(page);
    await seedVerifiedIssuer(page);

    await page.getByRole("button", { name: /Create Invoice/i }).click();
    await expect(
      page.getByRole("dialog", { name: /Create Invoice/i }),
    ).toBeVisible();

    await page.getByPlaceholder(/Stellar Public Key/i).fill(MOCK_BUYER);
    await page.getByPlaceholder(/50,000\.00/i).fill("1000");
    await selectDueDate(page, invoiceMocks.dueDate.input);

    await page
      .getByRole("checkbox", {
        name: /List for immediate LP financing at creation/i,
      })
      .uncheck();

    await page.getByRole("button", { name: /Review Financing Terms/i }).click();
    await page.getByRole("button", { name: /Create Invoice/i }).click();

    await expect(page.getByText(/Invoice Created/i)).toBeVisible({
      timeout: 15000,
    });

    await page.getByRole("row").filter({ hasText: /INV#/i }).click();

    await page
      .getByRole("button", { name: /Configure financing terms/i })
      .click();
    await page.getByRole("button", { name: /List Terms/i }).click();

    invoiceMocks.markListed();
    await expect(page.getByText(/Invoice Listed for Financing/i)).toBeVisible({
      timeout: 15000,
    });

    invoiceMocks.markFunded();
    await page.reload();
    await connectAsIssuer(page);
    await seedVerifiedIssuer(page);
    await page.getByRole("row").filter({ hasText: /INV#/i }).click();

    await page.getByRole("button", { name: /Mark Goods Shipped/i }).click();

    invoiceMocks.markShipped();
    await expect(page.getByText(/Invoice Shipped/i)).toBeVisible({
      timeout: 15000,
    });
    await expect(
      page.getByRole("status", { name: /Invoice status: Active/i }),
    ).toBeVisible();
  });
});

test.describe("SME Issuer Flow - Secondary Flows", () => {
  test("Wallet disconnection from SME dashboard", async ({ page }) => {
    await setupIssuerApiMocks(page);
    await connectAsIssuer(page);

    await page.getByRole("button", { name: /Disconnect wallet/i }).click();

    await expect(
      page.getByRole("button", { name: /Connect Wallet/i }),
    ).toBeVisible({ timeout: 10000 });
  });

  test("Frontend error states", async ({ page }) => {
    await page.goto("/this-route-does-not-exist");
    await expect(
      page.getByText(/Page not found/i).or(page.getByText(/404/i)),
    ).toBeVisible();
  });
});
