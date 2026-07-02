import { test as base } from "@playwright/test";

const MOCK_PUBLIC_KEY = "GBMOCKWALLETADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(`
      window.__MOCK_FREIGHTER_ADDRESS__ = "GBMOCKWALLETADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
    `);

    await use(page);
  },
});
