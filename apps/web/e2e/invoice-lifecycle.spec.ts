import { expect } from "@playwright/test";
import { test } from "./fixtures/freighter";

test.describe("Invoice Lifecycle - Happy Path", () => {
  test("Complete flow: Connect, Create, Fund, Ship, Deliver, Repay", async ({
    page,
  }) => {
    // 1. Navigation and Wallet Connection
    await page.goto("/");

    const connectBtn = page.getByRole("button", { name: /Connect Wallet/i });
    if (await connectBtn.isVisible()) {
      await connectBtn.click();
    }

    // Expect to be connected
    await expect(
      page.getByText("GBMOCKWALLETADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"),
    ).toBeVisible();

    // 2. Invoice Creation
    await page.goto("/dashboard/issuer"); // Assuming route for issuer
    await page.getByRole("button", { name: /Create Invoice/i }).click();

    await page
      .getByLabelText(/Buyer Address/i)
      .fill("GBBUYERXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
    await page.getByLabelText(/Face Value/i).fill("1000");
    await page.getByRole("button", { name: /Next/i }).click();

    await page.getByRole("button", { name: /Confirm & Create/i }).click();

    // Wait for creation success (depends on app routing, maybe goes to invoice details)
    await expect(page.getByText(/Invoice Created Successfully/i)).toBeVisible();

    // 3. List for Financing
    await page.getByRole("button", { name: /List for Financing/i }).click();
    await page.getByRole("button", { name: /Confirm Listing/i }).click();
    await expect(page.getByText(/Successfully Listed/i)).toBeVisible();

    // 4. Funding the invoice (Assuming investor role or mock)
    // In a real E2E, we might need to switch accounts or mock the role
    // For this test, let's assume the UI allows the action or we navigate to pool
    await page.goto("/pool");
    await page
      .getByRole("button", { name: /Fund Invoice/i })
      .first()
      .click();
    await page.getByRole("button", { name: /Confirm Funding/i }).click();
    await expect(page.getByText(/Successfully Funded/i)).toBeVisible();

    // 5. Shipment
    await page.goto("/dashboard/issuer");
    await page
      .getByRole("button", { name: /Mark Shipped/i })
      .first()
      .click();
    await page.getByRole("button", { name: /Confirm Shipment/i }).click();
    await expect(page.getByText(/Status: Shipped/i)).toBeVisible();

    // 6. Delivery confirmation
    // Assume we can click it if we are buyer, or we just test the button is there
    await page.goto("/dashboard/buyer");
    await page
      .getByRole("button", { name: /Confirm Delivery/i })
      .first()
      .click();
    await page.getByRole("button", { name: /Confirm/i }).click();
    await expect(page.getByText(/Status: Delivered/i)).toBeVisible();

    // 7. Repayment
    await page.getByRole("button", { name: /Repay/i }).first().click();
    await page.getByRole("button", { name: /Confirm Repayment/i }).click();
    await expect(page.getByText(/Status: Repaid/i)).toBeVisible();
  });
});

test.describe("Secondary Flows", () => {
  test("Wallet Disconnection", async ({ page }) => {
    await page.goto("/");

    const connectBtn = page.getByRole("button", { name: /Connect Wallet/i });
    if (await connectBtn.isVisible()) {
      await connectBtn.click();
    }

    const disconnectBtn = page.getByRole("button", { name: /Disconnect/i });
    await disconnectBtn.click();

    await expect(
      page.getByRole("button", { name: /Connect Wallet/i }),
    ).toBeVisible();
  });

  test("Frontend Error States", async ({ page }) => {
    // Navigate to a non-existent route to check error boundary / 404
    await page.goto("/this-route-does-not-exist");
    await expect(
      page.getByText(/Page not found/i).or(page.getByText(/404/i)),
    ).toBeVisible();
  });
});
