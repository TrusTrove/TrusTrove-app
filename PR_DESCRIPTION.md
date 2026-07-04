## Summary

Adds `totalShares` to the SDK `PoolStats` model so consumers can derive LP share supply from on-chain state, and fixes the CI failures that blocked this branch.

## What this PR does

### Feature: `totalShares` on `PoolStats`
- `packages/sdk/src/types/index.ts` — add `totalShares: bigint` to the `PoolStats` interface.
- `packages/sdk/src/types/schemas.ts` — add `totalShares: bigintSchema` to `poolStatsSchema`; reuses the existing bigint coercion so the field defaults to `0n` for older contract responses (backward compatible).
- `apps/web/lib/api.ts` — `parseRawPoolStats` now also reads `raw.total_shares` so the web app's `PoolStats` literal satisfies the updated type.

### CI fixes (so CI is green)
- `packages/sdk/src/types/index.ts` and `packages/sdk/src/types/schemas.ts` — each file's entire content was declared twice (introduced when the `totalShares` field was appended during this branch). Deduplicated: only the version with `totalShares` is kept. Resolves the `tsc` duplicate-identifier / block-scoped-variable errors that were breaking `pnpm build`.
- `packages/sdk/package.json` — adopt upstream's vitest setup (`vitest` `^4.1.9` devDep + `vitest run --passWithNoTests` test script) and convert the new `schemas.test.ts` from `node:test`/`node:assert` to vitest's `describe`/`it`/`expect`. This aligns with the rest of the SDK test suite (already on vitest) so `pnpm test` compiles and runs cleanly under Node 20. The Go indexer is unaffected.

## Tests
- New: `packages/sdk/src/types/schemas.test.ts` covers `totalShares` parsing from plain objects, from the `Map` returned by `scValToNative`, numeric and string coercion to `bigint`, the absent-field default of `0n`, regression of the existing fields, and a compile-time check that `totalShares` is in the `PoolStats` interface. Run via `vitest run` together with the upstream SDK unit tests.

## How to verify

```
pnpm install --frozen-lockfile
pnpm build         # SDK + web
pnpm test          # SDK (vitest) + web
pnpm --filter web lint
(cd indexer && go build ./... && go vet ./... && go test ./...)
```

All four are green locally and on CI with this PR's commit.

## Out of scope / follow-ups
- Document `total_shares` in `docs/openapi/indexer.yaml`'s pool-stats response.
- Wire the Go indexer's pool-stats query so it actually returns `total_shares` from the DB (until then, the web will always read `0n`).
- Two pre-existing lint warnings (`useParams` in `InvoiceDetailClient.tsx`, unused `inter` in `invoice/[invoiceId]/page.tsx`) — warnings only, not CI-blocking.
