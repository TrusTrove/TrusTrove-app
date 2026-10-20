/**
 * Security headers and Content-Security-Policy for the web app.
 *
 * Plain `.mjs` (typed with JSDoc) so that both `next.config.mjs`, which
 * cannot import TypeScript, and `middleware.ts` share one implementation.
 * The policy itself is documented in
 * `docs/developer-guide/security-headers.md`; update that page whenever an
 * allowance is added or removed here.
 *
 * Two delivery paths:
 * - {@link buildSecurityHeaders}: static hardening headers, returned from
 *   `headers()` in `next.config.mjs` and always enforced.
 * - {@link buildContentSecurityPolicy}: the CSP, set per request by
 *   `middleware.ts` because it carries a fresh script nonce each time.
 */

/**
 * Fallbacks the app itself uses when the matching `NEXT_PUBLIC_*` var is
 * unset (`lib/api.ts`, `hooks/useBalances.ts`, `packages/sdk/src/config.ts`).
 * The CSP must allow whatever the browser will actually call, so an unset var
 * resolves to the same default rather than to nothing.
 */
export const DEFAULT_API_BASE_URL = "http://localhost:8080";
export const DEFAULT_HORIZON_URL = "https://horizon-testnet.stellar.org";
export const DEFAULT_SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";

/** Env flag that switches the CSP from report-only to enforced. */
export const CSP_ENFORCE_ENV = "CSP_ENFORCE";

/** Request header `middleware.ts` uses to hand the nonce to `app/layout.tsx`. */
export const NONCE_HEADER = "x-nonce";

/**
 * Browser features the app never uses. Clipboard is deliberately absent: the
 * invoice page copies IDs and links with `navigator.clipboard.writeText`.
 * Freighter (including Ledger via Freighter) runs in the extension's own
 * context, so disabling `usb`/`hid` here does not affect it.
 */
const DISABLED_FEATURES = [
  "accelerometer",
  "browsing-topics",
  "camera",
  "geolocation",
  "gyroscope",
  "hid",
  "magnetometer",
  "microphone",
  "payment",
  "serial",
  "usb",
];

/**
 * @typedef {{ key: string, value: string }} Header
 * @typedef {{ source: string, headers: Header[] }} HeaderRule
 */

/**
 * Static hardening headers applied to every route.
 *
 * @param {{ isProduction: boolean }} options
 * @returns {HeaderRule[]} Value for `headers()` in `next.config.mjs`.
 */
export function buildSecurityHeaders({ isProduction }) {
  /** @type {Header[]} */
  const headers = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    {
      key: "Permissions-Policy",
      value: DISABLED_FEATURES.map((feature) => `${feature}=()`).join(", "),
    },
  ];
  if (isProduction) {
    // No includeSubDomains/preload: both reach beyond this app's own host and
    // are hard to undo, so they are left to the deployment owner.
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=31536000",
    });
  }
  return [{ source: "/(.*)", headers }];
}

/**
 * Reduces a URL to its origin (scheme, host and port).
 *
 * @param {string | undefined} url
 * @returns {string | null} The origin, or `null` when `url` is empty or not an
 *   absolute http(s) URL.
 */
export function toOrigin(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
      return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * @typedef {object} ConnectEnv
 * @property {string | undefined} apiBaseUrl - `NEXT_PUBLIC_API_BASE_URL`.
 * @property {string | undefined} horizonUrl - `NEXT_PUBLIC_HORIZON_URL`.
 * @property {string | undefined} sorobanRpcUrl - `NEXT_PUBLIC_SOROBAN_RPC_URL`.
 */

/**
 * Resolves the URLs the browser will actually call, applying the same
 * fallbacks as the app code when a var is unset.
 *
 * The SDK reads its config through `process.env?.NEXT_PUBLIC_*`, which Next
 * does not inline into client bundles, so in the browser it always uses the
 * testnet defaults. Those defaults are therefore always included alongside
 * the configured Horizon and Soroban RPC URLs.
 *
 * @param {Record<string, string | undefined>} env - Usually `process.env`.
 * @returns {string[]} URLs to allow in `connect-src` (not yet deduplicated).
 */
export function resolveConnectUrls(env) {
  return [
    env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL,
    env.NEXT_PUBLIC_HORIZON_URL || DEFAULT_HORIZON_URL,
    env.NEXT_PUBLIC_SOROBAN_RPC_URL || DEFAULT_SOROBAN_RPC_URL,
    DEFAULT_HORIZON_URL,
    DEFAULT_SOROBAN_RPC_URL,
  ];
}

/**
 * @typedef {object} CspOptions
 * @property {string} nonce - Fresh per request; allows Next's inline scripts
 *   and the theme bootstrap script.
 * @property {boolean} isDevelopment - `next dev` needs `'unsafe-eval'`.
 * @property {boolean} enforce - `upgrade-insecure-requests` is only valid in
 *   an enforced policy, so it is left out of report-only.
 * @property {string[]} connectUrls - URLs the browser fetches; reduced to
 *   unique origins. Empty or invalid entries are skipped.
 */

/**
 * Builds the Content-Security-Policy header value.
 *
 * @param {CspOptions} options
 * @returns {string}
 */
export function buildContentSecurityPolicy({
  nonce,
  isDevelopment,
  enforce,
  connectUrls,
}) {
  const connectOrigins = [
    ...new Set(
      connectUrls
        .map((url) => toOrigin(url))
        .filter((origin) => origin !== null),
    ),
  ];

  /** @type {Record<string, string[]>} */
  const directives = {
    "default-src": ["'self'"],
    // 'strict-dynamic' lets the nonced Next bootstrap load its chunks and the
    // Vercel Analytics/Speed Insights scripts; 'self' is the fallback for
    // browsers without CSP3.
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(isDevelopment ? ["'unsafe-eval'"] : []),
    ],
    // sonner and styled-jsx insert <style> elements at runtime with no nonce
    // hook, so inline styles cannot be restricted further yet.
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...connectOrigins],
    "frame-ancestors": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "object-src": ["'none'"],
  };

  const policy = Object.entries(directives).map(
    ([name, sources]) => `${name} ${sources.join(" ")}`,
  );
  if (enforce && !isDevelopment) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

/**
 * Whether the CSP is enforced. Report-only unless `CSP_ENFORCE=true`.
 *
 * @param {Record<string, string | undefined>} env - Usually `process.env`.
 * @returns {boolean}
 */
export function isCspEnforced(env) {
  return env[CSP_ENFORCE_ENV] === "true";
}

/**
 * @param {boolean} enforce
 * @returns {"Content-Security-Policy" | "Content-Security-Policy-Report-Only"}
 */
export function cspHeaderName(enforce) {
  return enforce
    ? "Content-Security-Policy"
    : "Content-Security-Policy-Report-Only";
}
