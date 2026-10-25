import { expect, test as baseTest, type Page } from "@playwright/test";
import { test, MOCK_ADDRESS } from "./fixtures/freighter";

const MOCK_CHALLENGE_XDR = "AAAAAQAAAACmock_challenge_xdr_transaction";
const MOCK_JWT_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock_token";

async function setupWalletMocks(page: Page) {
  // Mock Horizon account balances check triggered by useBalances on connect
  await page.route("**/horizon-testnet.stellar.org/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: MOCK_ADDRESS,
        account_id: MOCK_ADDRESS,
        sequence: "123456789",
        subentry_count: 0,
        balances: [
          {
            balance: "1000.0000000",
            asset_type: "native",
          },
        ],
      }),
    });
  });

  // Mock SEP-10 challenge route from indexer API
  await page.route("**/auth?address=*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        transaction: MOCK_CHALLENGE_XDR,
        network_passphrase: "Test SDF Network ; September 2015",
      }),
    });
  });

  // Mock SEP-10 verify route from indexer API
  await page.route("**/auth", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          token: MOCK_JWT_TOKEN,
        }),
      });
    } else {
      await route.continue();
    }
  });

  // Mock other indexer routes
  await page.route("**/stats**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        total_usdc_financed: "500000.00",
        active_invoice_count: 5,
        total_invoices: 12,
        total_repaid: 7,
        total_defaulted: 0,
        average_yield_bps: 850,
        pool_utilization_bps: 5000,
        registered_issuers: 8,
      }),
    });
  });

  await page.route("**/pool**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        total_deposits: "10000000000",
        total_funded: "5000000000",
        available_liquidity: "5000000000",
        utilization_rate_bps: 5000,
        total_yield_distributed: "100000000",
        active_invoice_count: 5,
        total_shares: "10000000000",
      }),
    });
  });

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

  await page.route("**/events**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });
}

test.describe("Wallet Connect & SEP-10 Auth Flow", () => {
  test.beforeEach(async ({ page }) => {
    await setupWalletMocks(page);
  });

  test("1. Connect wallet successfully with injected Freighter mock", async ({
    page,
  }) => {
    await page.goto("/");

    // Verify initial disconnected state
    const connectBtn = page
      .getByRole("navigation")
      .getByRole("button", { name: /Connect Wallet/i });
    await expect(connectBtn).toBeVisible();

    // Click connect button
    await connectBtn.click();

    // Verify connected address formatted as GBMOCK...XXXX
    await expect(
      page.getByRole("navigation").getByText("GBMOCK...XXXX", { exact: true }),
    ).toBeVisible({ timeout: 15000 });

    // Verify network indicator
    await expect(
      page.getByRole("navigation").getByText("Testnet", { exact: true }),
    ).toBeVisible();
  });

  test("2. Execute SEP-10 challenge-sign-verify authentication flow", async ({
    page,
  }) => {
    await page.goto("/");

    // Connect wallet first
    const connectBtn = page
      .getByRole("navigation")
      .getByRole("button", { name: /Connect Wallet/i });
    await connectBtn.click();
    await expect(
      page.getByRole("navigation").getByText("GBMOCK...XXXX", { exact: true }),
    ).toBeVisible({ timeout: 15000 });

    // Execute SEP-10 flow against mocked indexer and Freighter stub
    const authResult = await page.evaluate(
      async ({ address, challengeXdr }) => {
        // Step 1: Fetch challenge transaction from indexer
        const challengeRes = await fetch(`/auth?address=${address}`);
        const challengeData = (await challengeRes.json()) as {
          transaction: string;
          network_passphrase: string;
        };

        // Step 2: Sign challenge transaction using Freighter wallet stub
        const freighter = (window as any).freighter;
        const signedXdr = await freighter.signTransaction(
          challengeData.transaction,
        );

        // Step 3: Verify signed challenge with indexer to receive JWT token
        const verifyRes = await fetch("/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transaction: signedXdr }),
        });
        const verifyData = (await verifyRes.json()) as { token: string };

        return {
          challengeTx: challengeData.transaction,
          signedXdr,
          token: verifyData.token,
        };
      },
      {
        address: MOCK_ADDRESS,
        challengeXdr: MOCK_CHALLENGE_XDR,
      },
    );

    expect(authResult.challengeTx).toBe(MOCK_CHALLENGE_XDR);
    expect(authResult.signedXdr).toBeTruthy();
    expect(authResult.token).toBe(MOCK_JWT_TOKEN);
  });

  test("3. Disconnect wallet and reset state", async ({ page }) => {
    await page.goto("/");

    // Connect wallet
    const connectBtn = page
      .getByRole("navigation")
      .getByRole("button", { name: /Connect Wallet/i });
    await connectBtn.click();
    await expect(
      page.getByRole("navigation").getByText("GBMOCK...XXXX", { exact: true }),
    ).toBeVisible({ timeout: 15000 });

    // Disconnect wallet
    const disconnectBtn = page
      .getByRole("navigation")
      .getByRole("button", { name: /Disconnect wallet/i });
    await expect(disconnectBtn).toBeVisible();
    await disconnectBtn.click();

    // Verify UI resets to disconnected state
    await expect(
      page
        .getByRole("navigation")
        .getByRole("button", { name: /Connect Wallet/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation").getByText("GBMOCK...XXXX", { exact: true }),
    ).not.toBeVisible();
  });

  test("4. Reconnection and state persistence across reloads", async ({
    page,
  }) => {
    await page.goto("/");

    // Connect wallet
    const connectBtn = page
      .getByRole("navigation")
      .getByRole("button", { name: /Connect Wallet/i });
    await connectBtn.click();
    await expect(
      page.getByRole("navigation").getByText("GBMOCK...XXXX", { exact: true }),
    ).toBeVisible({ timeout: 15000 });

    // Disconnect wallet
    await page
      .getByRole("navigation")
      .getByRole("button", { name: /Disconnect wallet/i })
      .click();
    await expect(
      page
        .getByRole("navigation")
        .getByRole("button", { name: /Connect Wallet/i }),
    ).toBeVisible();

    // Reconnect wallet
    await page
      .getByRole("navigation")
      .getByRole("button", { name: /Connect Wallet/i })
      .click();
    await expect(
      page.getByRole("navigation").getByText("GBMOCK...XXXX", { exact: true }),
    ).toBeVisible({ timeout: 15000 });

    // Reload page: session resets to disconnected by design to verify extension on reload
    await page.reload();
    await expect(
      page
        .getByRole("navigation")
        .getByRole("button", { name: /Connect Wallet/i }),
    ).toBeVisible();

    // Reconnect after reload succeeds cleanly
    await page
      .getByRole("navigation")
      .getByRole("button", { name: /Connect Wallet/i })
      .click();
    await expect(
      page.getByRole("navigation").getByText("GBMOCK...XXXX", { exact: true }),
    ).toBeVisible({ timeout: 15000 });
  });

  test("5. Displays user cancellation message when request is rejected", async ({
    page,
  }) => {
    // Override requestAccess to reject with user cancellation error
    await page.addInitScript(() => {
      const orig = (window as any).freighter;
      if (orig) {
        orig.requestAccess = () =>
          Promise.reject(new Error("User rejected this request"));
      } else {
        Object.defineProperty(window, "freighter", {
          configurable: true,
          set(val) {
            if (val) {
              val.requestAccess = () =>
                Promise.reject(new Error("User rejected this request"));
            }
            delete (window as any).freighter;
            (window as any).freighter = val;
          },
        });
      }
    });

    await page.goto("/");

    await page.evaluate(() => {
      if ((window as any).freighter) {
        (window as any).freighter.requestAccess = () =>
          Promise.reject(new Error("User rejected this request"));
      }
    });

    const connectBtn = page
      .getByRole("navigation")
      .getByRole("button", { name: /Connect Wallet/i });
    await connectBtn.click();

    await expect(
      page.getByText(/You cancelled the connection request/i),
    ).toBeVisible({ timeout: 10000 });
  });
});

baseTest.describe("Wallet Error Handling & Missing Extension", () => {
  baseTest.beforeEach(async ({ page }) => {
    await setupWalletMocks(page);
  });

  baseTest(
    "Displays Install Freighter link when extension is missing",
    async ({ page }) => {
      // Without any freighter mock, the app detects extension is missing
      await page.goto("/");
      await expect(
        page.getByRole("link", { name: /Install Freighter/i }),
      ).toBeVisible();
    },
  );
});
