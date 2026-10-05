import { expect, test } from "@playwright/test";

const statsPayload = {
  total_usdc_financed: "1250000",
  pool_utilization_bps: 7250,
  average_yield_bps: 812,
  registered_issuers: 12,
  total_invoices: 1200,
  active_invoice_count: 300,
  total_repaid: 850,
  total_defaulted: 50,
};

const snapshotsPayload = [
  {
    timestamp: 1_700_000_000,
    utilizationRateBps: 7250,
    totalYieldDistributed: "12340000",
  },
  {
    timestamp: 1_700_086_400,
    utilizationRateBps: 7500,
    totalYieldDistributed: "23450000",
  },
];

async function mockAnalyticsEndpoints(
  page: import("@playwright/test").Page,
  statsStatus = 200,
) {
  await page.route("**/stats", async (route) => {
    await route.fulfill({
      status: statsStatus,
      contentType: "application/json",
      body: JSON.stringify(
        statsStatus === 200 ? statsPayload : { error: "offline" },
      ),
    });
  });
  await page.route("**/pool/snapshots", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(snapshotsPayload),
    });
  });
}

test.describe("public analytics page", () => {
  test("renders stats and the pool chart without connecting a wallet", async ({
    page,
  }) => {
    await mockAnalyticsEndpoints(page);
    await page.goto("/analytics");

    await expect(
      page.getByRole("heading", { name: "Protocol Analytics" }),
    ).toBeVisible();
    await expect(page.getByText("72.5%")).toBeVisible();
    await expect(page.getByText("8.12%")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Pool Performance" }),
    ).toBeVisible();
    await expect(
      page.getByRole("img", { name: /pool utilization is currently/i }),
    ).toBeVisible();
    await expect(page.getByText(/GB[A-Z0-9]{8,}/)).toHaveCount(0);
  });

  test("shows stats placeholders on an API failure without crashing the chart", async ({
    page,
  }) => {
    await mockAnalyticsEndpoints(page, 500);
    await page.goto("/analytics");

    await expect(
      page.getByText(/Live stats are temporarily unavailable/),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Pool Performance" }),
    ).toBeVisible();
    await expect(page.getByText("—")).toHaveCount(8);
  });

  test("Navbar Analytics link navigates to /analytics", async ({ page }) => {
    await mockAnalyticsEndpoints(page);
    await page.goto("/");

    const analyticsLink = page.getByRole("link", { name: "Analytics" });
    await expect(analyticsLink).toHaveAttribute("href", "/analytics");
    await analyticsLink.click();

    await expect(page).toHaveURL(/\/analytics$/);
    await expect(
      page.getByRole("heading", { name: "Protocol Analytics" }),
    ).toBeVisible();
  });
});
