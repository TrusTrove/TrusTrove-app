- closes #995
- closes #998
- closes #999
- closes #1003

## #995 — lazy SDK imports

Navbar/landing-page code no longer imports `@stellar/stellar-sdk` or the
contract clients eagerly:

- `useBalances` loads `Horizon` inside the query function.
- `usePool` constructs `PoolClient` only when a deposit/withdraw mutation runs.
- `useProfile` / `useTokenAllowance` defer the SDK import until a query,
  mutation, or allowance actually needs it.
- `lib/parsers.ts` imports `invoiceSchema` from the new lightweight
  `@trusttrove/sdk/schemas` entry point instead of the SDK barrel.

### Bundle comparison

`ANALYZE=true pnpm --filter web build` (First Load JS):

| Route                  | Before  | After   | Change         |
| ---------------------- | ------- | ------- | -------------- |
| `/`                    | 477 kB  | 238 kB  | −239 kB (−50%) |
| `/dashboard`           | 491 kB  | 251 kB  | −240 kB (−49%) |
| `/invoice/[invoiceId]` | 477 kB  | 238 kB  | −239 kB (−50%) |
| `/marketplace`         | 450 kB  | 210 kB  | −240 kB (−53%) |
| `/analytics`           | 531 kB  | 291 kB  | −240 kB (−45%) |
| Shared by all          | 87.8 kB | 87.9 kB | +0.1 kB        |

## #998 — form field labelling

Buyer, Asset, and Due Date now use `useId`-based `id`/`htmlFor` pairs.
`DatePicker` forwards `id`, `aria-describedby`, and `aria-labelledby` to its
trigger, and the due-date hint is linked with `aria-describedby`.

## #999 — responsive invoice form

The terms row is single-column below `sm`; at `sm` and up, Face Value + Asset
share a row and Due Date takes a full-width row. The date trigger truncates
long formatted dates (`min-w-0` / `truncate`), and a Playwright check asserts
no horizontal overflow at 320px and 375px.

## #1003 — copy button accessibility

Issuer/buyer copy buttons have distinct accessible names while keeping the
short visible label; the hash copy button has a ≥24px target. A shared polite
live region announces "Copied"/"Copy failed", clipboard access is wrapped in
try/catch with an error state, and the per-button timers are consolidated into
one cleaned-up timer.
