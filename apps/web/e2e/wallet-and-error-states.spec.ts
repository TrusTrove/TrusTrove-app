import { expect } from "@playwright/test";
import { test } from "./fixtures/freighter";

// App-wide behaviour that is not tied to one role's flow. These used to be
// copied into the SME, LP and invoice-lifecycle specs (#891).

test.describe("Wallet connection", () => {
  test("disconnecting from the Navbar returns a wallet-gated page to its connect gate", async ({
    page,
  }) => {
    // /lp renders a "Connect Your Wallet" gate in place of the portal until a
    // wallet is connected. The portal's indexer reads are not mocked here; the
    // shared fixture blocks them, which this test does not depend on.
    await page.goto("/lp");

    const nav = page.getByRole("navigation");
    const gate = page.getByRole("heading", { name: /Connect Your Wallet/i });
    await expect(gate).toBeVisible();

    // Scoped to the Navbar: the gate renders its own connect button too.
    await nav.getByRole("button", { name: /Connect Wallet/i }).click();

    // WalletConnect shows `truncateAddress(address)` — six leading and four
    // trailing characters (lib/format.ts).
    const connectedAddress = nav.getByText("GBMOCK...XXXX", { exact: true });
    await expect(connectedAddress).toBeVisible({ timeout: 15000 });
    await expect(gate).toHaveCount(0);

    await nav.getByRole("button", { name: /Disconnect wallet/i }).click();

    await expect(
      nav.getByRole("button", { name: /Connect Wallet/i }),
    ).toBeVisible({ timeout: 10000 });
    await expect(connectedAddress).toHaveCount(0);
    await expect(gate).toBeVisible();
  });
});

test.describe("Frontend error states", () => {
  test("an unknown route renders the 404 page", async ({ page }) => {
    const response = await page.goto("/this-route-does-not-exist");
    expect(response?.status()).toBe(404);

    // Copy from app/not-found.tsx.
    await expect(
      page.getByRole("heading", { level: 1, name: "404" }),
    ).toBeVisible();
    await expect(page.getByText("This page doesn't exist.")).toBeVisible();
    await expect(page.getByRole("link", { name: /Go Home/i })).toHaveAttribute(
      "href",
      "/",
    );
    await expect(
      page.getByRole("link", { name: /View Invoices/i }),
    ).toHaveAttribute("href", "/marketplace");
  });
});
