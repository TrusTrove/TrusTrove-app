import { expect, type Page } from "@playwright/test";
import { test } from "./fixtures/freighter";

const MOCK_WALLET = "GBMOCKWALLETADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

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

async function setupDashboardApiMocks(page: Page) {
  // Mock the invoices list endpoint
  await page.route("**/invoices**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      }),
    });
  });

  // Mock the recent events endpoint
  await page.route("**/events**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });
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

test.describe("Dashboard Smoke Test", () => {
  test("Dashboard renders key protocol stats and recent activity", async ({
    page,
  }) => {
    await setupStellarNetworkMocks(page);
    await setupDashboardApiMocks(page);
    await connectAsIssuer(page);

    // Assert key protocol stats render
    await expect(page.getByText("Created")).toBeVisible();
    await expect(page.getByText("Currently Listed")).toBeVisible();
    await expect(page.getByText("Funded & Active")).toBeVisible();
    await expect(page.getByText("Total Repaid")).toBeVisible();
    await expect(page.getByText("Total Financed")).toBeVisible();

    // Assert recent activity section renders
    await expect(
      page.getByRole("heading", { name: /On-Chain Activity Logs/i }),
    ).toBeVisible();
    await expect(page.getByText(/No events recorded yet/i)).toBeVisible();

    // Assert issued invoices section renders
    await expect(
      page.getByRole("heading", { name: /Issued Invoices/i }),
    ).toBeVisible();
    await expect(page.getByText(/No invoices yet/i)).toBeVisible();

    // Assert management console renders
    await expect(
      page.getByRole("heading", { name: /Management console/i }),
    ).toBeVisible();
  });
});
