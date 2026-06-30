import { test as base } from "@playwright/test";

// Extend basic test by providing a mocked freighter window object
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      window.freighter = {
        isConnected: () => Promise.resolve(true),
        isAllowed: () => Promise.resolve(true),
        setAllowed: () => Promise.resolve(),
        requestAccess: () => Promise.resolve(""),
        signTransaction: (xdr: string) => Promise.resolve("signed-xdr-mock"),
        signAuthEntry: () => Promise.resolve("signed-auth-mock"),
        getPublicKey: () =>
          Promise.resolve(
            "GBMOCKWALLETADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
          ),
        getNetworkDetails: () => Promise.resolve({ network: "TESTNET" }),
      };
    });
    await use(page);
  },
});
