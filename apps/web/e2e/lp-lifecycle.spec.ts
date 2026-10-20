import { expect, type Page } from "@playwright/test";
import { test, MOCK_ADDRESS } from "./fixtures/freighter";

/**
 * Wire fixtures for the two indexer endpoints the LP portal reads
 * (`getPoolStats` / `getLPPosition` in `lib/api.ts`). The base URL defaults to
 * `http://localhost:8080`, so stubbing them keeps these specs independent of a
 * running backend — the same approach `marketplace-browse.spec.ts` and
 * `sme-issuer-flow.spec.ts` already use for `/invoices`.
 *
 * Amounts are stroops: 1 USDC = 10_000_000.
 */
const POOL_STATS = {
  total_deposits: "100000000000", // 10,000.00
  total_funded: "40000000000", // 4,000.00
  available_liquidity: "60000000000", // 6,000.00
  utilization_rate_bps: 4000, // 40.0%
  total_yield_distributed: "2000000000", // 200.00
  active_invoice_count: 7,
};

const LP_POSITION = {
  shares: "25000000000", // 2,500.00
  usdc_value: "26000000000", // 2,600.00
  yield_earned: "1000000000", // 100.00
  deposit_count: 3,
};

async function mockPoolApi(
  page: Page,
  position: typeof LP_POSITION = LP_POSITION,
) {
  await page.route("**/pool/stats", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(POOL_STATS),
    }),
  );
  await page.route(`**/pool/position/${MOCK_ADDRESS}`, async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(position),
    }),
  );
}

async function connectWallet(page: Page) {
  await page.goto("/lp");

  // Scoped to the Navbar: the "Connect Your Wallet" gate renders its own
  // connect button in the page body.
  const nav = page.getByRole("navigation");
  const connectBtn = nav.getByRole("button", { name: /Connect Wallet/i });
  if (await connectBtn.isVisible()) {
    await connectBtn.click();
  }

  // WalletConnect shows `truncateAddress(address)` — six leading and four
  // trailing characters (lib/format.ts).
  await expect(nav.getByText("GBMOCK...XXXX", { exact: true })).toBeVisible({
    timeout: 15000,
  });
}

test.describe("LP Lifecycle - Pool Deposit & Redeem", () => {
  test.beforeEach(async ({ page }) => {
    await mockPoolApi(page);
    await connectWallet(page);
  });

  test("should display the LP dashboard with all key sections", async ({
    page,
  }) => {
    // Header
    await expect(
      page.getByRole("heading", { name: /Liquidity Provider Portal/i }),
    ).toBeVisible();

    // Pool Overview
    await expect(
      page.getByRole("heading", { name: /Pool Overview/i }),
    ).toBeVisible();
    await expect(page.getByText(/Utilization/i)).toBeVisible();
    await expect(page.getByText(/Total Deposits/i)).toBeVisible();
    await expect(page.getByText(/Available Liquidity/i)).toBeVisible();
    await expect(page.getByText(/Yield Distributed/i)).toBeVisible();
    await expect(page.getByText(/Active Invoices/i)).toBeVisible();

    // My Position
    await expect(
      page.getByRole("heading", { name: /My Position/i }),
    ).toBeVisible();
    await expect(page.getByText(/Active LP Position/i)).toBeVisible();
    await expect(page.getByText(/Current USDC Value/i)).toBeVisible();
    await expect(page.getByText(/Redeemable Shares/i)).toBeVisible();
    await expect(page.getByText(/Accrued Yield/i)).toBeVisible();

    // Deposit & withdraw forms
    await expect(
      page.getByRole("heading", { name: /Deposit USDC/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Withdraw Liquidity/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Withdraw Shares/i }),
    ).toBeVisible();
  });

  test("should render the pool overview and position from the API", async ({
    page,
  }) => {
    // Utilization gauge: 4000 bps -> 40.0%
    await expect(page.getByText("40.0%")).toBeVisible();

    // The four pool stats, formatted from stroops by `formatAmount`.
    await expect(page.getByText("10,000.00 USDC")).toBeVisible();
    await expect(page.getByText("6,000.00 USDC")).toBeVisible();
    await expect(page.getByText("200.00 USDC")).toBeVisible();
    await expect(page.getByText("7", { exact: true })).toBeVisible();

    // The connected wallet's position.
    await expect(page.getByText("3 deposits")).toBeVisible();
    await expect(page.getByText("2,600.00 USDC")).toBeVisible();
    // `exact` because the withdraw form also shows "Available: 2,500.00 USDC".
    await expect(
      page.getByText("2,500.00 USDC", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("100.00 USDC")).toBeVisible();
  });

  test("should show a deposit simulation preview while typing an amount", async ({
    page,
  }) => {
    await page.locator("#deposit-amount").fill("5000");

    // `SimulationPreview` renders once the debounced simulation starts. No pool
    // contract is configured in this environment, so it settles on the failure
    // branch rather than a fee breakdown.
    await expect(page.getByText(/Simulation/i).first()).toBeVisible();
  });

  test("should show and hide the deposit preview when clearing the input", async ({
    page,
  }) => {
    const amountInput = page.locator("#deposit-amount");

    await amountInput.fill("10000");
    await expect(page.getByText(/Simulation/i).first()).toBeVisible();

    await amountInput.fill("");
    await expect(page.getByText(/Simulation/i)).toHaveCount(0);
  });

  test("should disable withdrawal while the wallet holds no LP shares", async ({
    page,
  }) => {
    await mockPoolApi(
      page,
      { shares: "0", usdc_value: "0", yield_earned: "0", deposit_count: 0 },
      "no-position",
    );
    await connectWallet(page);

    await expect(
      page.getByRole("button", { name: /Withdraw Shares/i }),
    ).toBeDisabled();
    await expect(page.getByText(/Available: 0\.00 USDC/i)).toBeVisible();
  });

  test("should ask for confirmation before withdrawing liquidity", async ({
    page,
  }) => {
    await page.locator("#withdraw-shares").fill("100");
    await page.getByRole("button", { name: /Withdraw Shares/i }).click();

    // `handleWithdraw` routes through the global ConfirmationDialog
    // (components/shared/ConfirmationDialog.tsx) with label
    // "Withdraw LP liquidity".
    const dialog = page.getByRole("dialog", {
      name: /Confirm Withdraw LP liquidity/i,
    });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(page.getByText(/This action is irreversible/i)).toBeVisible();

    await page.getByRole("button", { name: /Cancel/i }).click();
    await expect(dialog).toHaveCount(0);
  });

  test("should not submit a deposit for an empty amount", async ({ page }) => {
    const depositBtn = page.getByRole("button", { name: /Deposit USDC/i });
    await expect(depositBtn).toBeEnabled();

    await depositBtn.click();

    // `handleDeposit` returns before calling the mutation, so no deposit flow
    // starts and the field stays empty.
    await expect(page.getByText(/Deposit Complete/i)).toHaveCount(0);
    await expect(page.locator("#deposit-amount")).toHaveValue("");
  });

  test("should not submit a withdraw for an empty share count", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /Withdraw Shares/i }).click();

    await expect(
      page.getByRole("dialog", { name: /Confirm Withdraw LP liquidity/i }),
    ).toHaveCount(0);
  });
});

test.describe("LP Lifecycle - Secondary Flows", () => {
  test("Wallet Disconnection from LP page", async ({ page }) => {
    await mockPoolApi(page);
    await connectWallet(page);

    const nav = page.getByRole("navigation");
    await nav.getByRole("button", { name: /Disconnect wallet/i }).click();

    await expect(
      nav.getByRole("button", { name: /Connect Wallet/i }),
    ).toBeVisible({ timeout: 10000 });
  });

  test("Frontend Error States from LP page", async ({ page }) => {
    await page.goto("/this-route-does-not-exist");
    await expect(
      page.getByText(/Page not found/i).or(page.getByText(/404/i)),
    ).toBeVisible();
  });
});
