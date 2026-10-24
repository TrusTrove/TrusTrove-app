import { test as base } from "@playwright/test";

/**
 * Base `test` for the e2e suite that keeps every spec off the real network: a
 * request to any origin other than the app under test (Horizon, Soroban RPC,
 * the indexer API on :8080, third-party scripts) is aborted unless the spec
 * mocks it.
 *
 * `page.route` handlers take precedence over context routes, so a spec's own
 * mocks still answer first; this only sees requests none of them fulfilled (or
 * that they passed on with `route.fallback()`). A handler that calls
 * `route.continue()` sends the request to the network, so only do that for
 * the app's own origin.
 *
 * Specs that need the mocked Freighter wallet import `test` from
 * `./freighter`, which builds on this one.
 */
export const test = base.extend({
  context: async ({ context, baseURL }, use) => {
    const appOrigin = new URL(baseURL ?? "http://localhost:3000").origin;
    await context.route(
      (url) => url.origin !== appOrigin,
      (route) => route.abort("blockedbyclient"),
    );
    await use(context);
  },
});

export { expect } from "@playwright/test";
