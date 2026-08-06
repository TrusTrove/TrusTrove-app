import { expect, test as baseTest } from "@playwright/test";
import { test } from "./fixtures/freighter";

test.describe("Wallet Connect & SEP-10 Auth Flow", () => {
  const MOCK_ADDRESS = "GBMOCKWALLETADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
  const MOCK_CHALLENGE_XDR = "AAAAAQAAAACmock_challenge_xdr_transaction";
  const MOCK_JWT_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock_token";

  test.beforeEach(async ({ page }) => {
    // Intercept indexer SEP-10 authentication API calls
    await page.route("**/auth?address=*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          transaction: MOCK_CHALLENGE_XDR,
          network_passphrase: "Test SDF Network ; November 2015",
        }),
      });
    });

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

    // Mock other indexer calls if needed
    await page.route("**/pool/stats", async (route) => {
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

    await page.route("**/stats", async (route) => {
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
  });

  test("1. Connect wallet successfully with injected Freighter mock", async ({
    page,
  }) => {
    await page.goto("/");

    // Verify initial disconnected state
    const connectBtn = page.getByRole("button", { name: /CONNECT WALLET/i });
    await expect(connectBtn).toBeVisible();

    // Click connect button
    await connectBtn.click();

    // Verify connected address (formatted address: GBMOCK...AAAA or GBMOCK...XXXX)
    await expect(page.getByText(/GBMOCK\.\.\.XXXX/i)).toBeVisible();

    // Verify network indicator
    await expect(page.getByText("Testnet")).toBeVisible();
  });

  test("2. Execute SEP-10 challenge-sign-verify authentication flow", async ({
    page,
  }) => {
    await page.goto("/");

    // Connect wallet first
    const connectBtn = page.getByRole("button", { name: /CONNECT WALLET/i });
    await connectBtn.click();
    await expect(page.getByText(/GBMOCK\.\.\.XXXX/i)).toBeVisible();

    // Execute SEP-10 login flow programmatically via window evaluate or store
    const authResult = await page.evaluate(async () => {
      const walletStore = (window as any).__WALLET_STORE__ || {};
      const { fetchChallenge, verifyChallenge } = await import("@/lib/api");
      const { signTransaction } = await import("@stellar/freighter-api");

      const address = "GBMOCKWALLETADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
      const challenge = await fetchChallenge(address);
      const signedXdr = await signTransaction(challenge.transaction, {
        network: "TESTNET",
        networkPassphrase: challenge.network_passphrase,
        accountToSign: address,
      });
      const { token } = await verifyChallenge(signedXdr);

      return {
        challengeTx: challenge.transaction,
        signedXdr,
        token,
      };
    });

    expect(authResult.challengeTx).toBe(MOCK_CHALLENGE_XDR);
    expect(authResult.signedXdr).toBe("signed-xdr-mock");
    expect(authResult.token).toBe(MOCK_JWT_TOKEN);
  });

  test("3. Disconnect wallet and reset state", async ({ page }) => {
    await page.goto("/");

    // Connect wallet
    const connectBtn = page.getByRole("button", { name: /CONNECT WALLET/i });
    await connectBtn.click();
    await expect(page.getByText(/GBMOCK\.\.\.XXXX/i)).toBeVisible();

    // Disconnect wallet
    const disconnectBtn = page.getByRole("button", {
      name: /Disconnect wallet/i,
    });
    await expect(disconnectBtn).toBeVisible();
    await disconnectBtn.click();

    // Verify UI resets to disconnected state
    await expect(
      page.getByRole("button", { name: /CONNECT WALLET/i }),
    ).toBeVisible();
    await expect(page.getByText(/GBMOCK\.\.\.XXXX/i)).not.toBeVisible();

    // Verify Zustand storage in localStorage is cleared/reset
    const storageState = await page.evaluate(() => {
      const item = localStorage.getItem("wallet-storage");
      return item ? JSON.parse(item) : null;
    });

    expect(storageState?.state?.address).toBeNull();
  });

  test("4. Reconnection and state persistence across reloads", async ({
    page,
  }) => {
    await page.goto("/");

    // Connect wallet
    await page.getByRole("button", { name: /CONNECT WALLET/i }).click();
    await expect(page.getByText(/GBMOCK\.\.\.XXXX/i)).toBeVisible();

    // Reload page
    await page.reload();

    // Verify state persists after reload
    await expect(page.getByText(/GBMOCK\.\.\.XXXX/i)).toBeVisible();

    // Disconnect and reconnect
    await page.getByRole("button", { name: /Disconnect wallet/i }).click();
    await expect(
      page.getByRole("button", { name: /CONNECT WALLET/i }),
    ).toBeVisible();

    await page.getByRole("button", { name: /CONNECT WALLET/i }).click();
    await expect(page.getByText(/GBMOCK\.\.\.XXXX/i)).toBeVisible();
  });
});

baseTest.describe("Wallet Error Handling & Uninstalled Extension", () => {
  baseTest(
    "Displays user cancellation message when request is rejected",
    async ({ page }) => {
      await page.addInitScript(() => {
        window.freighter = {
          isConnected: () => Promise.resolve(true),
          isAllowed: () => Promise.resolve(true),
          setAllowed: () => Promise.resolve(),
          requestAccess: () =>
            Promise.reject(new Error("User rejected this request")),
          signTransaction: () => Promise.resolve(""),
          signAuthEntry: () => Promise.resolve(""),
          getPublicKey: () => Promise.resolve(""),
          getNetworkDetails: () => Promise.resolve({ network: "TESTNET" }),
        };
      });

      await page.goto("/");
      const connectBtn = page.getByRole("button", { name: /CONNECT WALLET/i });
      await connectBtn.click();

      await expect(
        page.getByText(/You cancelled the connection request/i),
      ).toBeVisible();
    },
  );

  baseTest(
    "Displays Install Freighter link when extension is missing",
    async ({ page }) => {
      await page.addInitScript(() => {
        delete (window as any).freighter;
      });

      await page.goto("/");
      await expect(
        page.getByRole("link", { name: /Install Freighter/i }),
      ).toBeVisible();
    },
  );
});
