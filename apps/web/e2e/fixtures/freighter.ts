import { test as base } from "@playwright/test";

/** Address the mocked Freighter extension always signs in with. */
export const MOCK_ADDRESS =
  "GBMOCKWALLETADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

/**
 * `localStorage` key the app writes once the onboarding tour has been shown.
 * Mirrors `ONBOARDING_SEEN_KEY` in `store/onboarding.ts`.
 */
export const ONBOARDING_SEEN_KEY = "trusttrove:onboarding-tour-seen";

type FreighterFixtures = {
  /**
   * Whether to pre-seed the "tour already seen" flag. Defaults to `true` so
   * the first-connect onboarding tour never covers a test's own interactions.
   * Set it to `false` in specs that exercise the tour itself.
   */
  skipOnboardingTour: boolean;
};

/**
 * Shared Freighter mock for the e2e suite.
 *
 * Two layers are needed because `@stellar/freighter-api` talks to the
 * extension over `window.postMessage` and only short-circuits
 * `isConnected()` on a `window.freighter` object:
 *  - `window.freighter` keeps `isFreighterInstalled()` (and any spec that
 *    pokes the object directly) working;
 *  - a `message` listener answers the `FREIGHTER_EXTERNAL_MSG_REQUEST`
 *    protocol, which is what makes `requestAccess()`, `getPublicKey()` and
 *    `getNetworkDetails()` resolve. Those requests have no timeout in the
 *    library, so without a responder the Connect button stays on
 *    "CONNECTING..." forever.
 *
 * Responses are read from the live `window.freighter` object so specs can
 * still swap the connected address (see notifications.spec.ts).
 */
export const test = base.extend<FreighterFixtures>({
  skipOnboardingTour: [true, { option: true }],
  page: async ({ page, skipOnboardingTour }, use) => {
    await page.addInitScript(
      ({ address, seenKey, seedSeenFlag }) => {
        if (seedSeenFlag) {
          window.localStorage.setItem(seenKey, "true");
        }

        const freighter = {
          isConnected: () => Promise.resolve(true),
          isAllowed: () => Promise.resolve(true),
          setAllowed: () => Promise.resolve(),
          requestAccess: () => Promise.resolve(address),
          signTransaction: (xdr: string) => Promise.resolve(xdr),
          signAuthEntry: () => Promise.resolve("signed-auth-mock"),
          getPublicKey: () => Promise.resolve(address),
          getNetworkDetails: () => Promise.resolve({ network: "TESTNET" }),
        };
        (window as any).freighter = freighter;

        window.addEventListener("message", async (event: MessageEvent) => {
          const request = event.data as {
            source?: string;
            messageId?: number;
            type?: string;
            transactionXdr?: string;
            entryXdr?: string;
          };
          if (request?.source !== "FREIGHTER_EXTERNAL_MSG_REQUEST") return;

          // Read through the live mock so spec-level overrides (a different
          // address, for instance) are honoured by every request.
          const api = (window as any).freighter as typeof freighter;
          let payload: Record<string, unknown>;

          switch (request.type) {
            case "REQUEST_ACCESS":
              payload = { publicKey: await api.requestAccess() };
              break;
            case "REQUEST_PUBLIC_KEY":
              payload = { publicKey: await api.getPublicKey() };
              break;
            case "REQUEST_NETWORK_DETAILS": {
              const details = await api.getNetworkDetails();
              payload = {
                networkDetails: {
                  network: details.network,
                  networkName: "Test SDF Network ; September 2015",
                  networkUrl: "https://horizon-testnet.stellar.org",
                  networkPassphrase: "Test SDF Network ; September 2015",
                  sorobanRpcUrl: "https://soroban-testnet.stellar.org",
                },
              };
              break;
            }
            case "REQUEST_NETWORK":
              payload = { network: "TESTNET" };
              break;
            case "REQUEST_CONNECTION_STATUS":
              payload = { isConnected: await api.isConnected() };
              break;
            case "REQUEST_ALLOWED_STATUS":
            case "SET_ALLOWED_STATUS":
              payload = { isAllowed: await api.isAllowed() };
              break;
            case "REQUEST_USER_INFO":
              payload = { userInfo: { publicKey: await api.getPublicKey() } };
              break;
            case "SUBMIT_TRANSACTION":
              payload = {
                signedTransaction: await api.signTransaction(
                  request.transactionXdr ?? "",
                ),
              };
              break;
            case "SUBMIT_AUTH_ENTRY":
              payload = { signedAuthEntry: await api.signAuthEntry() };
              break;
            default:
              payload = {};
          }

          window.postMessage(
            {
              source: "FREIGHTER_EXTERNAL_MSG_RESPONSE",
              messagedId: request.messageId,
              error: "",
              ...payload,
            },
            window.location.origin,
          );
        });
      },
      {
        address: MOCK_ADDRESS,
        seenKey: ONBOARDING_SEEN_KEY,
        seedSeenFlag: skipOnboardingTour,
      },
    );
    await use(page);
  },
});

export { expect } from "@playwright/test";
