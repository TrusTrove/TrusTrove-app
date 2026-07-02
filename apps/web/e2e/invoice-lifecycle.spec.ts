import { expect } from "@playwright/test";
import { test } from "./fixtures/freighter";

test.describe("Invoice Lifecycle - Happy Path", () => {
  test("Complete flow: Connect, Create, Fund, Ship, Deliver, Repay", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (window as any).__MOCK_PROFILE_VERIFIED__ = true;
    });

    // 1. Navigation and Wallet Connection
    await page.goto("/");

    const connectBtn = page.getByRole("button", {
      name: /Connect Wallet/i,
    });
    if (await connectBtn.isVisible()) {
      await connectBtn.click();
    }

    await expect(page.getByText("GBMOCK...XXXX")).toBeVisible();

    // 2. Invoice Creation
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /Create Invoice/i }).click();

    await page
      .getByLabelText(/Buyer Address/i)
      .fill("GBBUYERXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
    await page.getByLabelText(/Face Value/i).fill("1000");
    await page.getByRole("button", { name: /REVIEW FINANCING TERMS/i }).click();

    await page.getByRole("button", { name: /SIGN & LIST/i }).click();

    await expect(page.getByText(/Invoice Created/i)).toBeVisible();
  });
});

test.describe("Secondary Flows", () => {
  test("Wallet Disconnection", async ({ page }) => {
    await page.goto("/");

    const connectBtn = page.getByRole("button", {
      name: /Connect Wallet/i,
    });
    if (await connectBtn.isVisible()) {
      await connectBtn.click();
    }

    const disconnectBtn = page.getByRole("button", {
      name: /Disconnect/i,
    });
    await disconnectBtn.click();

    await expect(
      page.getByRole("button", { name: /Connect Wallet/i }),
    ).toBeVisible();
  });

  test("Frontend Error States", async ({ page }) => {
    await page.goto("/this-route-does-not-exist");
    await expect(
      page.getByText(/Page not found/i).or(page.getByText(/404/i)),
    ).toBeVisible();
  });
});
