import { expect, type Page } from "@playwright/test";
import { test, ONBOARDING_SEEN_KEY } from "./fixtures/freighter";

const STEP_TITLES = [
  "Welcome to TrusTrove",
  "Pick your role",
  "Your wallet balances",
  "SME Dashboard",
  "LP Portal",
  "Marketplace",
  "Profile & verification",
  "You're all set",
];

/** The Navbar's connect button (the page body also renders one on some routes). */
function connectButton(page: Page) {
  return page
    .getByRole("navigation")
    .getByRole("button", { name: /connect wallet/i });
}

async function connectWallet(page: Page) {
  await connectButton(page).click();
  await expect(
    page.getByRole("navigation").getByText("GBMOCK...XXXX", { exact: true }),
  ).toBeVisible({ timeout: 15000 });
}

function seenFlag(page: Page) {
  return page.evaluate(
    (key) => window.localStorage.getItem(key),
    ONBOARDING_SEEN_KEY,
  );
}

test.describe("Onboarding tour on first connect", () => {
  // Opt out of the fixture's seeding so the walkthrough actually opens.
  test.use({ skipOnboardingTour: false });

  test("opens on connect, steps forwards and backwards, and closes on Escape", async ({
    page,
  }) => {
    await page.goto("/");

    // Nothing to dismiss before a wallet is connected.
    await expect(page.getByTestId("onboarding-tour")).toHaveCount(0);

    await connectWallet(page);

    const tour = page.getByTestId("onboarding-tour");
    const stepTitle = tour.getByRole("heading");

    await expect(stepTitle).toHaveText(STEP_TITLES[0]);
    await expect(tour.getByText("Step 1 of 8")).toBeVisible();

    // Forward through every remaining step.
    for (let i = 1; i < STEP_TITLES.length; i++) {
      await tour.getByRole("button", { name: "Next" }).click();
      await expect(stepTitle).toHaveText(STEP_TITLES[i]);
    }
    await expect(tour.getByRole("button", { name: "Finish" })).toBeVisible();

    // And back again.
    for (let i = STEP_TITLES.length - 2; i >= 0; i--) {
      await tour.getByRole("button", { name: "Back" }).click();
      await expect(stepTitle).toHaveText(STEP_TITLES[i]);
    }

    // Escape dismisses the overlay.
    await page.keyboard.press("Escape");
    await expect(tour).toHaveCount(0);
  });

  test("records the seen flag and stays dismissed across a reload", async ({
    page,
  }) => {
    await page.goto("/");
    await connectWallet(page);

    const tour = page.getByTestId("onboarding-tour");
    await expect(tour).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(tour).toHaveCount(0);

    await expect.poll(() => seenFlag(page)).toBe("true");

    // Reconnecting after a reload must not bring the tour back.
    await page.reload();
    await connectWallet(page);
    await expect(page.getByTestId("onboarding-tour")).toHaveCount(0);
  });

  test("can be relaunched on demand from the Navbar", async ({ page }) => {
    await page.goto("/");
    await connectWallet(page);

    const tour = page.getByTestId("onboarding-tour");
    await page.keyboard.press("Escape");
    await expect(tour).toHaveCount(0);

    await page
      .getByRole("navigation")
      .locator('[data-tour="tour-launcher"]:visible')
      .click();

    await expect(tour).toBeVisible();
    await expect(tour.getByRole("heading")).toHaveText("Welcome to TrusTrove");
  });
});

test.describe("Onboarding tour suppressed by the shared fixture", () => {
  test("does not open for specs that do not opt out", async ({ page }) => {
    // Guards the regression that made the overlay swallow clicks across the
    // whole suite: the flag is seeded before any app code runs.
    await page.goto("/");
    await expect.poll(() => seenFlag(page)).toBe("true");

    await connectWallet(page);
    await expect(page.getByTestId("onboarding-tour")).toHaveCount(0);
  });
});
