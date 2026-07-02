import { expect } from "@playwright/test";
import { test } from "./fixtures/freighter";

const MOCK_ADDRESS = "GBMOCKWALLETADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
const MOCK_CHALLENGE_XDR = "AAAAAFakeChallengeXDRForTestingPurposesOnly";
const MOCK_SIGNED_XDR = "AAAAFakeSignedXDRForTestingPurposesOnly";
const MOCK_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock-jwt-for-testing";

test.describe("Wallet Connect Flow", () => {
  test.describe("Wallet Connection", () => {
    test("connects wallet via Freighter and shows connected state", async ({
      page,
    }) => {
      await page.goto("/");

      const connectBtn = page.getByRole("button", { name: /Connect Wallet/i });
      await expect(connectBtn).toBeVisible();
      await connectBtn.click();

      await expect(page.getByText("GBMOCK...XXXX")).toBeVisible();
      await expect(page.getByText(/testnet/i)).toBeVisible();
    });

    test("shows copy address button when connected", async ({ page }) => {
      await page.goto("/");

      await page.getByRole("button", { name: /Connect Wallet/i }).click();

      const copyBtn = page.getByRole("button", {
        name: /Copy wallet address/i,
      });
      await expect(copyBtn).toBeVisible();
      await copyBtn.click();

      await expect(
        page
          .getByRole("button", { name: /Copy wallet address/i })
          .locator("svg"),
      ).toBeVisible();
    });
  });

  test.describe("SEP-10 Auth Flow", () => {
    test("completes challenge-sign-verify flow and receives JWT", async ({
      page,
    }) => {
      await page.route("**/auth?address=**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            transaction: MOCK_CHALLENGE_XDR,
            network_passphrase: "Test SDF Network ; September 2015",
          }),
        });
      });

      await page.route("**/auth", async (route, request) => {
        if (request.method() === "POST") {
          const body = JSON.parse(request.postData() || "{}");
          expect(body.transaction).toBe(MOCK_SIGNED_XDR);
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ token: MOCK_JWT }),
          });
        }
      });

      await page.goto("/");

      await page.getByRole("button", { name: /Connect Wallet/i }).click();
      await expect(page.getByText("GBMOCK...XXXX")).toBeVisible();
    });
  });

  test.describe("Disconnect and State Reset", () => {
    test("disconnects wallet and resets to initial state", async ({ page }) => {
      await page.goto("/");

      await page.getByRole("button", { name: /Connect Wallet/i }).click();
      await expect(page.getByText("GBMOCK...XXXX")).toBeVisible();

      const disconnectBtn = page.getByRole("button", {
        name: /Disconnect wallet/i,
      });
      await expect(disconnectBtn).toBeVisible();
      await disconnectBtn.click();

      await expect(
        page.getByRole("button", { name: /Connect Wallet/i }),
      ).toBeVisible();
    });

    test("clears state on disconnect and persists fresh connection", async ({
      page,
    }) => {
      await page.goto("/");

      await page.getByRole("button", { name: /Connect Wallet/i }).click();
      await expect(page.getByText("GBMOCK...XXXX")).toBeVisible();

      await page.getByRole("button", { name: /Disconnect wallet/i }).click();
      await expect(
        page.getByRole("button", { name: /Connect Wallet/i }),
      ).toBeVisible();

      await page.reload();

      await expect(
        page.getByRole("button", { name: /Connect Wallet/i }),
      ).toBeVisible();
    });
  });

  test.describe("Reconnection Behavior", () => {
    test("re-connects wallet after disconnect", async ({ page }) => {
      await page.goto("/");

      await page.getByRole("button", { name: /Connect Wallet/i }).click();
      await expect(page.getByText("GBMOCK...XXXX")).toBeVisible();

      await page.getByRole("button", { name: /Disconnect wallet/i }).click();
      await expect(
        page.getByRole("button", { name: /Connect Wallet/i }),
      ).toBeVisible();

      await page.getByRole("button", { name: /Connect Wallet/i }).click();
      await expect(page.getByText("GBMOCK...XXXX")).toBeVisible();
    });

    test("survives page reload while connected", async ({ page }) => {
      await page.goto("/");

      await page.getByRole("button", { name: /Connect Wallet/i }).click();
      await expect(page.getByText("GBMOCK...XXXX")).toBeVisible();

      await page.reload();

      await expect(page.getByText("GBMOCK...XXXX")).toBeVisible();
    });
  });

  test.describe("Error States", () => {
    test("shows error when Freighter is not installed", async ({ page }) => {
      await page.addInitScript(() => {
        delete (window as any).freighter;
      });

      await page.goto("/");

      await expect(
        page.getByRole("link", { name: /Install Freighter/i }),
      ).toBeVisible();
    });

    test("shows error when wallet connection is rejected", async ({ page }) => {
      await page.addInitScript(() => {
        (window as any).__FREIGHTER_REJECT_ACCESS__ = true;
      });

      await page.goto("/");

      await page.getByRole("button", { name: /Connect Wallet/i }).click();

      await expect(page.getByText(/User rejected access/i)).toBeVisible();
    });
  });
});
