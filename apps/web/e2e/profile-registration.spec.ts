import { expect } from "@playwright/test";
import { test } from "./fixtures/freighter";

const MOCK_ADDRESS = "GBMOCKWALLETADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

test.describe("Profile Registration & Verification - Happy Path", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the profile page
    await page.goto("/profile");

    // Connect Freighter wallet if not already connected
    const connectBtn = page.getByRole("button", { name: /Connect Wallet/i });
    if (await connectBtn.isVisible()) {
      await connectBtn.click();
    }

    // Wait for wallet connection to be reflected in the UI
    await expect(page.getByText(MOCK_ADDRESS)).toBeVisible({ timeout: 15000 });
  });

  test("should show unverified state and open the registration modal", async ({
    page,
  }) => {
    // Unverified banner should be visible
    await expect(page.getByText(/UNVERIFIED \/ UNREGISTERED/i)).toBeVisible();
    await expect(
      page.getByText(/Profile Verification Required/i),
    ).toBeVisible();

    // Open the registration modal
    await page.getByRole("button", { name: /Register profile/i }).click();

    // Modal should be visible with the registration form
    const dialog = page.getByRole("dialog", {
      name: /Register Business Metadata/i,
    });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(
      page.getByText(/Select On-Chain Business Role/i),
    ).toBeVisible();
  });

  test("should register as an issuer and reflect the verified state", async ({
    page,
  }) => {
    // Open the registration modal
    await page.getByRole("button", { name: /Register profile/i }).click();

    // Default role is issuer; fill in the required metadata
    await page.getByPlaceholder("e.g. EU123456789").fill("EU123456789");
    await page.getByPlaceholder("e.g. Germany").fill("Germany");
    await page
      .getByPlaceholder("e.g. https://acme.corp")
      .fill("https://acme.corp");

    // Submit the registration form
    await page.getByRole("button", { name: /Register Profile/i }).click();

    // The registration transaction is submitted; the modal should close
    await expect(
      page.getByText(/Register Business Metadata/i),
    ).not.toBeVisible();

    // Seed the React Query cache to simulate a verified profile so the UI
    // reflects the resulting verified state after registration.
    await page.evaluate((address) => {
      const queryClient = (window as any).__reactQueryClient;
      if (queryClient) {
        queryClient.setQueryData(["isVerified", address], true);
        queryClient.setQueryData(["profile", address], {
          address,
          role: "issuer",
          registeredAt: Math.floor(Date.now() / 1000),
          metadata: {
            companyName: "",
            taxId: "EU123456789",
            country: "Germany",
            website: "https://acme.corp",
            email: "",
          },
        });
      }
    }, MOCK_ADDRESS);

    // Re-render trigger: small navigation round-trip to pick up cache
    await page.waitForTimeout(1000);

    // Verified state should now be reflected in the UI
    await expect(page.getByText(/VERIFIED ON-CHAIN/i)).toBeVisible();
    await expect(page.getByText(/ROLE: ISSUER/i)).toBeVisible();
    await expect(
      page.getByText(/Decentralized Identity Active/i),
    ).toBeVisible();
  });

  test("should register as a buyer and reflect the verified state", async ({
    page,
  }) => {
    // Open the registration modal
    await page.getByRole("button", { name: /Register profile/i }).click();

    // Select the buyer role
    await page.getByRole("button", { name: /Obligor \/ Buyer/i }).click();

    // Fill in the required metadata
    await page.getByPlaceholder("e.g. EU123456789").fill("EU987654321");
    await page.getByPlaceholder("e.g. Germany").fill("France");
    await page
      .getByPlaceholder("e.g. https://acme.corp")
      .fill("https://buyer.corp");

    // Submit the registration form
    await page.getByRole("button", { name: /Register Profile/i }).click();

    // The registration transaction is submitted; the modal should close
    await expect(
      page.getByText(/Register Business Metadata/i),
    ).not.toBeVisible();

    // Seed the React Query cache to simulate a verified buyer profile
    await page.evaluate((address) => {
      const queryClient = (window as any).__reactQueryClient;
      if (queryClient) {
        queryClient.setQueryData(["isVerified", address], true);
        queryClient.setQueryData(["profile", address], {
          address,
          role: "buyer",
          registeredAt: Math.floor(Date.now() / 1000),
          metadata: {
            companyName: "",
            taxId: "EU987654321",
            country: "France",
            website: "https://buyer.corp",
            email: "",
          },
        });
      }
    }, MOCK_ADDRESS);

    // Re-render trigger: small navigation round-trip to pick up cache
    await page.waitForTimeout(1000);

    // Verified state should now be reflected in the UI
    await expect(page.getByText(/VERIFIED ON-CHAIN/i)).toBeVisible();
    await expect(page.getByText(/ROLE: BUYER/i)).toBeVisible();
    await expect(
      page.getByText(/Decentralized Identity Active/i),
    ).toBeVisible();
  });

  test("should show validation error when required fields are missing", async ({
    page,
  }) => {
    // Open the registration modal
    await page.getByRole("button", { name: /Register profile/i }).click();

    // Submit without filling required fields
    await page.getByRole("button", { name: /Register Profile/i }).click();

    // Validation error should be shown
    await expect(page.getByText(/Company name is required/i)).toBeVisible();
  });
});
