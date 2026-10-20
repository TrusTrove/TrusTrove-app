import { expect, test } from "@playwright/test";

const THEME_KEY = "trusttrove:theme";
const NEXT_SCRIPTS = "**/_next/static/**/*.js";

async function expectSystemThemeBeforeHydration(
  page: import("@playwright/test").Page,
  colorScheme: "light" | "dark",
) {
  await page.emulateMedia({ colorScheme });
  await page.addInitScript((key) => localStorage.removeItem(key), THEME_KEY);

  let releaseScripts = () => {};
  const scriptsMayLoad = new Promise<void>((resolve) => {
    releaseScripts = resolve;
  });
  await page.route(NEXT_SCRIPTS, async (route) => {
    await scriptsMayLoad;
    await route.continue();
  });

  try {
    await page.goto("/", { waitUntil: "commit" });
    await page.waitForFunction(
      (expectedScheme) =>
        document.documentElement.style.colorScheme === expectedScheme,
      colorScheme,
    );

    const root = page.locator("html");
    if (colorScheme === "dark") {
      await expect(root).toHaveClass(/\bdark\b/);
    } else {
      await expect(root).not.toHaveClass(/\bdark\b/);
    }
  } finally {
    releaseScripts();
    await page.unroute(NEXT_SCRIPTS);
  }
}

test.describe("theme preference", () => {
  test("uses the system preference before hydration, then toggles and persists the choice", async ({
    page,
  }) => {
    await expectSystemThemeBeforeHydration(page, "light");

    await page.getByRole("button", { name: "Switch to dark theme" }).click();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await expect(
      page.getByRole("button", { name: "Switch to light theme" }),
    ).toBeVisible();
    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), THEME_KEY))
      .toBe("dark");

    await page.reload();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  });

  test("uses the dark system preference on first load when storage is empty", async ({
    page,
  }) => {
    await expectSystemThemeBeforeHydration(page, "dark");
  });

  test("keeps the theme usable when local storage is blocked", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get() {
          throw new DOMException("Storage is blocked", "SecurityError");
        },
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Switch to light theme" }).click();
    await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
    await expect(
      page.getByRole("button", { name: "Switch to dark theme" }),
    ).toBeVisible();
  });

  test("keeps the saved theme with the mobile navigation layout", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.emulateMedia({ colorScheme: "light" });
    await page.addInitScript(
      (key) => localStorage.setItem(key, "dark"),
      THEME_KEY,
    );
    await page.goto("/");

    await expect(page.locator("html")).toHaveClass(/\bdark\b/);

    const menuButton = page.getByRole("button", {
      name: "Open navigation menu",
    });
    await menuButton.click();
    await expect(menuButton).toHaveAttribute("aria-expanded", "true");
  });
});
