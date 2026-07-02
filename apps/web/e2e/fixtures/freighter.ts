import { test as base } from "@playwright/test";

const MOCK_PUBLIC_KEY = "GBMOCKWALLETADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      (window as any).freighter = true;

      window.addEventListener("message", (event) => {
        if (event.source !== window) return;
        if (!event.data) return;
        if (event.data.source !== "FREIGHTER_EXTERNAL_MSG_REQUEST") return;

        const messageId = event.data.messageId;

        setTimeout(() => {
          const response: Record<string, any> = {
            source: "FREIGHTER_EXTERNAL_MSG_RESPONSE",
            messagedId: messageId,
          };

          const rejectAccess =
            (window as any).__FREIGHTER_REJECT_ACCESS__ === true;

          switch (event.data.type) {
            case "REQUEST_CONNECTION_STATUS":
              response.isConnected = true;
              break;
            case "REQUEST_ACCESS":
              if (rejectAccess) {
                response.error = "User rejected access";
              } else {
                response.publicKey = MOCK_PUBLIC_KEY;
              }
              break;
            case "REQUEST_PUBLIC_KEY":
              response.publicKey = MOCK_PUBLIC_KEY;
              break;
            case "SUBMIT_TRANSACTION":
            case "SUBMIT_BLOB":
            case "SUBMIT_AUTH_ENTRY":
              response.signedTransaction = "signed-xdr-mock";
              response.signedBlob = "signed-blob-mock";
              response.signedAuthEntry = "signed-auth-mock";
              break;
            case "REQUEST_NETWORK":
              response.network = "TESTNET";
              break;
            case "REQUEST_NETWORK_DETAILS":
              response.networkDetails = {
                network: "TESTNET",
                networkPassphrase: "Test SDF Network ; September 2015",
              };
              break;
            case "REQUEST_ALLOWED_STATUS":
              response.isAllowed = true;
              break;
            case "SET_ALLOWED_STATUS":
              response.isAllowed = true;
              break;
          }

          window.postMessage(response, window.location.origin);
        }, 10);
      });
    });

    await use(page);
  },
});
