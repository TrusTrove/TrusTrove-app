import { expect, type Page } from "@playwright/test";
import { test } from "./fixtures/freighter";

const MOCK_WALLET = "GBMOCKWALLETADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

const MOCK_INVOICES = [
  {
    id: "inv-listed-001",
    issuer: MOCK_WALLET,
    buyer: "GBBUYERADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    face_value: "10000000000",
    asset: "USDC",
    discount_bps: 200,
    funded_amount: "8000000000",
    due_date: 1735689600,
    status: "Listed",
    created_at: 1735603200,
    funded_at: null,
    shipped_at: null,
    issuer_confirmed: true,
    buyer_confirmed: false,
    repaid_at: null,
    listed_at: 1735603200,
    issuer_confirmed_at: null,
    buyer_confirmed_at: null,
    defaulted_at: null,
    transaction_hashes: ["hash1"],
    tx_hashes: ["txhash1"],
    created_tx_hash: "created_tx_hash_val",
    listed_tx_hash: "listed_tx_hash_val",
    funded_tx_hash: null,
    shipped_tx_hash: null,
    issuer_confirmed_tx_hash: null,
    buyer_confirmed_tx_hash: null,
    repaid_tx_hash: null,
    defaulted_tx_hash: null,
  },
  {
    id: "inv-funded-002",
    issuer: MOCK_WALLET,
    buyer: "GBBUYERADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    face_value: "5000000000",
    asset: "USDC",
    discount_bps: 150,
    funded_amount: "4250000000",
    due_date: 1735689600,
    status: "Funded",
    created_at: 1735603200,
    funded_at: 1735603200,
    shipped_at: null,
    issuer_confirmed: true,
    buyer_confirmed: false,
    repaid_at: null,
    listed_at: 1735603200,
    issuer_confirmed_at: null,
    buyer_confirmed_at: null,
    defaulted_at: null,
    transaction_hashes: ["hash2"],
    tx_hashes: ["txhash2"],
    created_tx_hash: "created_tx_hash_val",
    listed_tx_hash: "listed_tx_hash_val",
    funded_tx_hash: "funded_tx_hash_val",
    shipped_tx_hash: null,
    issuer_confirmed_tx_hash: null,
    buyer_confirmed_tx_hash: null,
    repaid_tx_hash: null,
    defaulted_tx_hash: null,
  },
];

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

async function setupMarketplaceApiMocks(page: Page) {
  // Mock the invoices list endpoint, filtering by status query param
  await page.route("**/invoices**", async (route) => {
    const url = new URL(route.request().url());
    const status = url.searchParams.get("status");
    const filtered = status
      ? MOCK_INVOICES.filter((inv) => inv.status === status)
      : MOCK_INVOICES;

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: filtered,
        total: filtered.length,
        page: 1,
        limit: 20,
        totalPages: 1,
      }),
    });
  });

  // Mock the pool stats endpoint
  await page.route("**/pool**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        availableLiquidity: "10000000000",
        totalFunded: "5000000000",
        totalRepaid: "0",
      }),
    });
  });

  // Mock the profile endpoint
  await page.route("**/profile**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        address: MOCK_WALLET,
        verified: true,
        role: "lp",
      }),
    });
  });
}

async function connectWallet(page: Page) {
  await page.goto("/marketplace");

  const connectBtn = page.getByRole("button", { name: /Connect Wallet/i });
  if (await connectBtn.isVisible()) {
    await connectBtn.click();
  }

  await expect(page.getByText(/GBMOCK\.\.\.XXXX/i)).toBeVisible({
    timeout: 15000,
  });
}

test.describe("Marketplace Browse & Filter Flow", () => {
  test("loads marketplace, filters listed invoices by status, and views details", async ({
    page,
  }) => {
    await setupStellarNetworkMocks(page);
    await setupMarketplaceApiMocks(page);
    await connectWallet(page);

    // Assert the marketplace page loads
    await expect(
      page.getByRole("heading", { name: /Invoice Marketplace/i }),
    ).toBeVisible();

    // Default filter is "Listed" — the listed invoice should be visible
    // (IDs are truncated in the table, e.g. "inv-li...001")
    await expect(page.getByText(/inv-li\.\.\.001/i)).toBeVisible();
    await expect(page.getByText(/inv-fu\.\.\.002/i)).not.toBeVisible();

    // Filter by "Funded" status
    await page.locator("select").first().selectOption("Funded");

    // The funded invoice should now be visible, and the listed one hidden
    await expect(page.getByText(/inv-fu\.\.\.002/i)).toBeVisible();
    await expect(page.getByText(/inv-li\.\.\.001/i)).not.toBeVisible();

    // Select the funded invoice to view its details in the Management Center
    await page.getByText(/inv-fu\.\.\.002/i).click();

    // Assert the management center shows the selected invoice details
    await expect(page.getByText(/POOL FINANCING PREVIEW/i)).toBeVisible();
    await expect(page.getByText(/Face Value:/i)).toBeVisible();
    await expect(page.getByText(/Funded Cost/i)).toBeVisible();
  });
});
