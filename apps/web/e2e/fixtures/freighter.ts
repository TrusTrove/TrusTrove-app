import { test as base } from "@playwright/test";

const MOCK_PUBLIC_KEY = "GBMOCKWALLETADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      (window as any).freighter = true;

      const originalPostMessage = window.postMessage.bind(window);

      const pending: Record<string, { resolve: (data: any) => void; reject: (err: any) => void }> = {};

      window.addEventListener("message", (event) => {
        if (event.source !== window) return;
        if (!event.data) return;
        if (event.data.source !== "FREIGHTER_EXTERNAL_MSG_RESPONSE") return;
        const msgId = event.data.messagedId;
        if (msgId != null && pending[msgId]) {
          pending[msgId].resolve(event.data);
          delete pending[msgId];
        }
      });

      window.postMessage = function (data: any, targetOrigin: string, transfer?: any) {
        if (data && data.source === "FREIGHTER_EXTERNAL_MSG_REQUEST") {
          const messageId = data.messageId;
          if (messageId != null) {
            const rejectAccess = (window as any).__FREIGHTER_REJECT_ACCESS__ === true;

            setTimeout(() => {
              const response: Record<string, any> = {
                source: "FREIGHTER_EXTERNAL_MSG_RESPONSE",
                messagedId: messageId,
              };

              switch (data.type) {
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
                  response.signedTransaction = "signed-xdr-mock";
                  break;
                case "SUBMIT_BLOB":
                  response.signedBlob = "signed-blob-mock";
                  break;
                case "SUBMIT_AUTH_ENTRY":
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

              originalPostMessage(response, targetOrigin, transfer);
            }, 10);
          }
        }

        return originalPostMessage(data, targetOrigin, transfer);
      } as typeof window.postMessage;
    });

    await use(page);
  },
});
