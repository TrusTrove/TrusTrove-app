# Security Headers and Content-Security-Policy

The web app asks users to approve Stellar transactions in Freighter, so a page that can be framed (clickjacking) or that runs an injected script (which could change what is displayed before signing) is a higher-impact failure than on a typical site. These headers are defence in depth on top of the app's other safeguards (no `dangerouslySetInnerHTML` on user data, JWT held in memory only).

Everything is built in one module, [`apps/web/lib/security-headers.mjs`](../../apps/web/lib/security-headers.mjs), which is plain `.mjs` so both `next.config.mjs` and `middleware.ts` can import it. The headers reach the browser by two routes:

| Where                                                              | What                                     | Why there                                                        |
| ------------------------------------------------------------------ | ---------------------------------------- | ---------------------------------------------------------------- |
| `headers()` in [`next.config.mjs`](../../apps/web/next.config.mjs) | Static hardening headers, every route    | Same value on every response; resolved once at build time        |
| [`middleware.ts`](../../apps/web/middleware.ts)                    | Content-Security-Policy, document routes | Carries a fresh script nonce per request, so it cannot be static |

## Static headers

Always enforced.

| Header                      | Value                                                                                                                                                  | Purpose                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `X-Content-Type-Options`    | `nosniff`                                                                                                                                              | Browsers must honour `Content-Type` rather than guess, so an uploaded or error response can't run as script.   |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`                                                                                                                      | Cross-origin requests (Horizon, Soroban RPC, the indexer, outbound links) see only the origin, never the path. |
| `X-Frame-Options`           | `DENY`                                                                                                                                                 | No page can be framed (clickjacking). Legacy twin of CSP `frame-ancestors 'none'`.                             |
| `Permissions-Policy`        | `accelerometer=(), browsing-topics=(), camera=(), geolocation=(), gyroscope=(), hid=(), magnetometer=(), microphone=(), payment=(), serial=(), usb=()` | Disables browser features the app never uses. See below.                                                       |
| `Strict-Transport-Security` | `max-age=31536000` (production builds only)                                                                                                            | Browsers use HTTPS for this host for a year after the first visit.                                             |

`next.config.mjs` also sets `poweredByHeader: false`, dropping `X-Powered-By: Next.js`.

**Permissions-Policy notes.** Clipboard is deliberately not restricted: the invoice page copies IDs and share links with `navigator.clipboard.writeText`. `usb` and `hid` are safe to disable because the app never talks to a Ledger directly; hardware wallets are reached through the Freighter extension, which runs in its own context and is not affected by the page's Permissions-Policy. If a feature is ever needed (for example a direct WebHID Ledger integration), remove it from `DISABLED_FEATURES`.

**HSTS notes.** `includeSubDomains` and `preload` are intentionally left out. Both apply beyond this app's own host and are slow to undo, so they are a decision for whoever owns the production domain. On `*.vercel.app` Vercel already sends its own `max-age=63072000; includeSubDomains; preload` (seen on `trustrove.vercel.app`), so the app's header matters for self-hosted and custom-domain deployments.

## Content-Security-Policy

Production policy (with the default testnet configuration):

```
default-src 'self';
script-src 'self' 'nonce-<per request>' 'strict-dynamic';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self';
connect-src 'self' http://localhost:8080 https://horizon-testnet.stellar.org https://soroban-testnet.stellar.org;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
object-src 'none'
```

(`connect-src` shows the local-dev API origin; in a deployment it is the origin of `NEXT_PUBLIC_API_BASE_URL`.)

| Directive                   | Sources                                     | Why each allowance is there                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `default-src`               | `'self'`                                    | Anything not listed below (manifest, workers, frames, media) is same-origin only.                                                                                                                                                                                                                                                                                                                                      |
| `script-src`                | `'self'`, `'nonce-…'`, `'strict-dynamic'`   | The App Router emits its own inline scripts (`self.__next_f.push(…)`, the RSC payload) on every page, and their content differs per page and build, so they cannot be hashed. Next adds the per-request nonce to them automatically. `'strict-dynamic'` lets those trusted scripts load the JS chunks and the Vercel Analytics / Speed Insights scripts. `'self'` is only a fallback for browsers without CSP Level 3. |
| `style-src`                 | `'self'`, `'unsafe-inline'`                 | sonner (toasts) and styled-jsx (`SkeletonLoader`, `TopStatusBar`) insert `<style>` elements at runtime and offer no nonce hook. Inline style injection is far less dangerous than inline script.                                                                                                                                                                                                                       |
| `img-src`                   | `'self'`, `data:`, `blob:`                  | All images are served from `public/`. `data:`/`blob:` cover locally generated images; there are no remote image hosts.                                                                                                                                                                                                                                                                                                 |
| `font-src`                  | `'self'`                                    | `next/font/google` downloads Inter and JetBrains Mono at build time and serves them from `/_next/static`.                                                                                                                                                                                                                                                                                                              |
| `connect-src`               | `'self'`, API, Horizon, Soroban RPC origins | See [connect-src origins](#connect-src-origins). Freighter needs nothing here: `@stellar/freighter-api` talks to the extension with `window.postMessage`, which CSP does not govern.                                                                                                                                                                                                                                   |
| `frame-ancestors`           | `'none'`                                    | No site may frame the app (clickjacking). Paired with `X-Frame-Options: DENY`.                                                                                                                                                                                                                                                                                                                                         |
| `base-uri`                  | `'self'`                                    | An injected `<base>` tag can't redirect relative script or link URLs elsewhere.                                                                                                                                                                                                                                                                                                                                        |
| `form-action`               | `'self'`                                    | Forms can only post to this origin.                                                                                                                                                                                                                                                                                                                                                                                    |
| `object-src`                | `'none'`                                    | No plugins (`<object>`, `<embed>`).                                                                                                                                                                                                                                                                                                                                                                                    |
| `upgrade-insecure-requests` | (production, enforced only)                 | Upgrades stray `http:` subresource URLs. Browsers ignore it in a report-only policy, so it is only sent when the CSP is enforced.                                                                                                                                                                                                                                                                                      |

### connect-src origins

`resolveConnectUrls()` lists the URLs the browser actually calls, and `buildContentSecurityPolicy()` reduces them to unique origins (scheme, host and port) with the `URL` API:

| Env var                       | Used by                                         | When unset                                                 |
| ----------------------------- | ----------------------------------------------- | ---------------------------------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL`    | `lib/api.ts` (indexer API)                      | `http://localhost:8080`, the same fallback as `lib/api.ts` |
| `NEXT_PUBLIC_HORIZON_URL`     | `hooks/useBalances.ts`, `hooks/useTxHistory.ts` | `https://horizon-testnet.stellar.org`                      |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | `@trusttrove/sdk`                               | `https://soroban-testnet.stellar.org`                      |

Unset vars resolve to the same defaults the code falls back to, because the CSP has to allow whatever the browser will really call.

The SDK's testnet Horizon and Soroban defaults are always included as well. `packages/sdk/src/config.ts` reads `process.env?.NEXT_PUBLIC_*` (optional chaining), which Next does not inline into client bundles, so in the browser the SDK currently uses the testnet defaults whatever the env says. Once that is fixed, drop `DEFAULT_HORIZON_URL` and `DEFAULT_SOROBAN_RPC_URL` from the end of `resolveConnectUrls()`.

`NEXT_PUBLIC_*` values are inlined when the app is built, in both the client bundle and the middleware, so the CSP and the code always agree. Changing one of these vars needs a rebuild, as it already did for the app itself.

## Report-only vs. enforced

The CSP ships as **`Content-Security-Policy-Report-Only`**: browsers log violations to the console but block nothing. `CSP_ENFORCE` is the single switch:

| `CSP_ENFORCE`         | Header sent                                                             |
| --------------------- | ----------------------------------------------------------------------- |
| unset / anything else | `Content-Security-Policy-Report-Only`                                   |
| `true`                | `Content-Security-Policy` (+ `upgrade-insecure-requests` in production) |

It is read by the middleware at request time, so on Vercel it is a plain (non-`NEXT_PUBLIC_`) environment variable: set it and redeploy, no code change. The static headers above, including `X-Frame-Options: DENY`, are enforced in both modes.

There is no violation-report endpoint yet, so in report-only mode violations only show up in the browser console. Before enforcing in production, load the main pages and run a full Freighter flow (connect, register, create invoice, sign) with DevTools open and confirm there are no `Content-Security-Policy` messages.

## The nonce and the theme script

`middleware.ts` generates a nonce (`btoa(crypto.randomUUID())`) for every document request and:

1. sets the CSP on the response;
2. sets the same CSP on the **request**, which is where Next's renderer looks for the nonce to add to its own `<script>` tags (it checks both the enforced and the report-only header);
3. forwards the nonce as the `x-nonce` request header, which `app/layout.tsx` reads with `headers()` and puts on the theme bootstrap `<script>`.

The theme bootstrap (`THEME_BOOTSTRAP_SCRIPT` in `apps/web/lib/theme.ts`) is the app's only hand-written inline script. It is covered by the nonce, so **editing the script needs no policy change**. Any new inline `<script>` must get the same `nonce={nonce}` prop or it will be blocked once the CSP is enforced. Prefer a normal module import over a new inline script.

The script tag also has `suppressHydrationWarning`: browsers blank the `nonce` attribute after parsing (so injected code can't read it back), which React would otherwise report as a hydration mismatch in development.

**Rendering cost.** A nonce has to be unique per response, so `app/layout.tsx` reads request headers and every route renders dynamically. The pages that were statically prerendered (`/`, `/dashboard`, `/lp`, `/marketplace`, `/sme`, `/profile`, `/analytics`, `/docs`) are now rendered per request and served with `Cache-Control: private, no-cache, no-store`. Static assets under `/_next/static` are unaffected and are excluded from the middleware.

## Development vs. production

| Setting                     | `next dev`                                               | `next build` / `next start`  |
| --------------------------- | -------------------------------------------------------- | ---------------------------- |
| `script-src 'unsafe-eval'`  | added (React Refresh and webpack dev tooling use `eval`) | not present                  |
| `upgrade-insecure-requests` | never                                                    | only when `CSP_ENFORCE=true` |
| `Strict-Transport-Security` | not sent                                                 | sent                         |

Hot reload uses a same-origin WebSocket, which `connect-src 'self'` already allows. In development the Vercel scripts load from `https://va.vercel-scripts.com`; `'strict-dynamic'` covers that without listing the host. To check the enforced policy locally, run `CSP_ENFORCE=true pnpm --filter web dev`.

## Adding a new external origin

1. **Pick the directive.** `fetch`/XHR/WebSocket/EventSource → `connect-src`. `<img>` or CSS `background-image` → `img-src`. Web fonts → `font-src`. An `<iframe>` you embed → add a `frame-src` directive. Scripts loaded by the app's own code are already covered by `'strict-dynamic'`; a third-party `<script src>` tag in the markup needs the nonce instead.
2. **Make it configurable** when the origin differs per environment: read it from a `NEXT_PUBLIC_*` var in the app code, and document the var in `.env.example` and [Environment Variables](environment-variables.md).
3. **Add it in `apps/web/lib/security-headers.mjs`.** For `connect-src`, add the URL (env var plus the same fallback the code uses) to the list returned by `resolveConnectUrls()`. For other directives, add the origin to the `directives` object in `buildContentSecurityPolicy()`. Use exact origins, never wildcards such as `https:` or `*.example.com`.
4. **Test it** in `apps/web/lib/security-headers.test.ts`: assert the new origin appears in the directive when the var is set, and (for optional integrations) that nothing is added when it is unset.
5. **Document it** by adding a row to the tables on this page with the reason for the allowance.
6. **Verify** with `next build && next start` (and `CSP_ENFORCE=true`) that the browser console shows no CSP violations on the affected pages.

## Tests

- `apps/web/lib/security-headers.test.ts`: header values, HSTS only in production, directive values, `connect-src` derived exactly from the given URLs (only `'self'` when none), `upgrade-insecure-requests` only when enforced, and the report-only switch.
- `apps/web/middleware.test.ts`: report-only by default, enforced with `CSP_ENFORCE=true`, a fresh nonce per request, the same nonce and policy forwarded to the render, and the `next.config.mjs` `headers()` wiring.

## Follow-ups

- Add a violation report endpoint (`report-to` / `report-uri`) so report-only mode produces data.
- Enforce the CSP (`CSP_ENFORCE=true`) once a Freighter flow has been checked against it in production.
- Decide on HSTS `includeSubDomains` / `preload` for the production domain.
- Fix the SDK's `process.env?.NEXT_PUBLIC_*` reads, then remove the always-included testnet defaults from `connect-src`.
