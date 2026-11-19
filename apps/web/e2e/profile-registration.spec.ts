import { expect, type Page } from "@playwright/test";
import { test, MOCK_ADDRESS } from "./fixtures/freighter";

/**
 * The profile page reads on-chain state through `useProfile` ->
 * `RegistryClient` (Soroban), so with no registry contract configured the
 * queries settle in an error state and the page renders its unregistered
 * branch. The verified-state tests seed the React Query cache through the
 * `window.__reactQueryClient` handle that `app/providers.tsx` publishes,
 * which is what makes the verified branch renderable without a chain.
 *
 * Both the profile and verification queries must be seeded; `isVerified`
 * drives the status banner and `profile` drives the details grid.
 */
function seedProfile(page: Page, role: "issuer" | "buyer") {
  return page.evaluate(
    ({ address, role }) => {
      const queryClient = (
        window as Window & {
          __reactQueryClient?: {
            setQueryData: (key: unknown[], value: unknown) => void;
          };
        }
      ).__reactQueryClient;
      if (!queryClient) throw new Error("React Query client not exposed");

      queryClient.setQueryData(["isVerified", address], true);
      queryClient.setQueryData(["profile", address], {
        address,
        role,
        verified: true,
        registeredAt: Math.floor(Date.now() / 1000),
        metadata: {
          companyName: "Acme Corporation",
          taxId: "REG-123456789",
          country: "United States",
          website: "https://acme.com",
          email: "contact@acme.com",
        },
      });
    },
    { address: MOCK_ADDRESS, role },
  );
}

async function openProfile(page: Page) {
  await page.goto("/profile");

  // Scoped to the Navbar: the "Connect Your Wallet" gate renders its own
  // connect button in the page body.
  const nav = page.getByRole("navigation");
  const connectBtn = nav.getByRole("button", { name: /Connect Wallet/i });
  if (await connectBtn.isVisible()) {
    await connectBtn.click();
  }

  await expect(nav.getByText("GBMOCK...XXXX", { exact: true })).toBeVisible({
    timeout: 15000,
  });

  // Wait for both profile queries to settle. With no registry contract
  // configured they retry before failing, which is slower than the default
  // assertion timeout.
  await expect(
    page.getByRole("heading", { name: /No Business Profile Found/i }),
  ).toBeVisible({ timeout: 30000 });
}

test.describe("Profile Registration & Verification - Happy Path", () => {
  test.beforeEach(async ({ page }) => {
    await openProfile(page);
  });

  test("should show the unregistered state and open the registration modal", async ({
    page,
  }) => {
    // The page offers registration as an SME Issuer or as a Buyer.
    await expect(
      page.getByText(/Register as an SME Issuer to tokenize/i),
    ).toBeVisible();

    await page
      .getByRole("button", { name: /Register Business Profile/i })
      .click();

    // Modal, keyed by its `aria-labelledby` title.
    const dialog = page.getByRole("dialog", {
      name: /Register Corporate Profile/i,
    });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");

    // Role selector and the required metadata fields.
    await expect(
      dialog.getByRole("button", { name: /SME \/ Issuer/i }),
    ).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Buyer/i })).toBeVisible();
    await expect(page.getByText(/Company Name \*/i)).toBeVisible();
    await expect(
      page.getByText(/Tax ID \/ Registration Number \*/i),
    ).toBeVisible();
    await expect(page.getByText(/Country of Incorporation \*/i)).toBeVisible();
    await expect(page.getByPlaceholder("e.g. Acme Corporation")).toBeVisible();
    await expect(page.getByPlaceholder("e.g. REG-123456789")).toBeVisible();
    await expect(page.getByPlaceholder("e.g. United States")).toBeVisible();
  });

  test("should require the mandatory metadata fields", async ({ page }) => {
    await page
      .getByRole("button", { name: /Register Business Profile/i })
      .click();

    const submit = page.getByRole("button", { name: /Submit Registration/i });

    // `handleRegisterSubmit` reports the first missing field.
    await submit.click();
    await expect(page.getByText(/Company name is required/i)).toBeVisible();

    await page
      .getByPlaceholder("e.g. Acme Corporation")
      .fill("Acme Corporation");
    await submit.click();
    await expect(
      page.getByText(/Tax ID\/Registration number is required/i),
    ).toBeVisible();

    await page.getByPlaceholder("e.g. REG-123456789").fill("REG-123456789");
    await submit.click();
    await expect(
      page.getByText(/Country of incorporation is required/i),
    ).toBeVisible();
  });

  // FIXME: CI builds with the testnet contract IDs, so the "registry client
  // not available" path is never reached. Tracked in https://github.com/TrusTrove/TrusTrove-app/issues/1175
  test.fixme("should submit a complete registration and report the missing registry contract", async ({
    page,
  }) => {
    await page
      .getByRole("button", { name: /Register Business Profile/i })
      .click();

    await page
      .getByPlaceholder("e.g. Acme Corporation")
      .fill("Acme Corporation");
    await page.getByPlaceholder("e.g. REG-123456789").fill("REG-123456789");
    await page.getByPlaceholder("e.g. United States").fill("United States");
    await page.getByPlaceholder("https://acme.com").fill("https://acme.com");
    await page.getByPlaceholder("contact@acme.com").fill("contact@acme.com");

    // Default role is the issuer.
    await page.getByRole("button", { name: /Submit Registration/i }).click();

    // No registry contract is configured in this environment, so building the
    // SDK's `RegistryClient` rejects ("Contract ID is required", from
    // `BaseContractClient`) and `handleRegisterSubmit` surfaces the failure in
    // the dialog's error panel. (`setShowPending(true/false)`
    // batch into a single render, so the transient pending modal is never
    // painted here - the error panel is the observable failure state.)
    await expect(
      page.getByText(/Contract ID is required/i).first(),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByRole("dialog", { name: /Register Corporate Profile/i }),
    ).toBeVisible();
  });

  test("should register as an issuer and reflect the verified state", async ({
    page,
  }) => {
    await seedProfile(page, "issuer");

    // Status banner and details grid use the strings the page renders.
    await expect(page.getByText(/Verified Corporate/i)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /SME \/ Issuer Profile/i }),
    ).toBeVisible();
    await expect(page.getByText(/On-Chain Status/i)).toBeVisible();
    await expect(page.getByText(/^Verified$/i)).toBeVisible();
    await expect(
      page.getByText(/Registered on Registry Contract/i),
    ).toBeVisible();

    // A registered profile can update its metadata instead of registering.
    await expect(
      page.getByRole("button", { name: /Update Metadata/i }),
    ).toBeVisible();
  });

  test("should register as a buyer and reflect the verified state", async ({
    page,
  }) => {
    await seedProfile(page, "buyer");

    await expect(page.getByText(/Verified Corporate/i)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Buyer Profile/i }),
    ).toBeVisible();
    // Corporate Information lists the role the profile was registered with.
    // Scoped to the row: the Navbar's role `<select>` also renders a "Buyer"
    // option.
    const roleRow = page.getByText("Role", { exact: true }).locator("..");
    await expect(roleRow.getByText(/^buyer$/i)).toBeVisible();
  });
});
