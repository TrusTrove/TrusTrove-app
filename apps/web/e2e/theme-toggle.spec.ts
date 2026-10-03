import { expect, test } from "@playwright/test";

const THEME_KEY = "trusttrove:theme";

test.describe("theme preference", () => {
  test("uses the system preference before hydration, then toggles and persists the choice", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.addInitScript((key) => localStorage.removeItem(key), THEME_KEY);

    await page.goto("/");
    await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);

    await page.getByRole("button", { name: "Switch to dark theme" }).click();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeVisible();
    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), THEME_KEY))
      .toBe("dark");

    await page.emulateMedia({ colorScheme: "light" });
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  });

  test("keeps the theme usable when local storage is blocked", async ({ page }) => {
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
    await expect(page.getByRole("button", { name: "Switch to dark theme" })).toBeVisible();
  });

  test("supports the theme toggle at a mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const toggle = page.getByRole("button", { name: /Switch to (light|dark) theme/ }).first();
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.locator("html")).toHaveClass(/\bdark\b|^$/);
  });
});
