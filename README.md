# TrusTrove

## Tech Stack

- **Web application:** Next.js app in `apps/web`.
- **TypeScript SDK:** `@trusttrove/sdk` in `packages/sdk`, with contract client wrappers.
- **React package:** `@trusttrove/sdk-react` in `packages/sdk-react`, with React hooks and providers.
- **CLI:** `@trusttrove/cli` in `packages/cli`.
- **Examples:** Runnable integrations and SDK usage in `examples/`.
- **Indexer and API:** Go service in `indexer/`.

## Local Setup

Run `docker-compose up` to start the one-command stack.

## Repository layout

- `apps/web` — Next.js web application
- `indexer` — Go Soroban event indexer and HTTP API
- `packages/sdk` — TypeScript SDK
- `packages/sdk-react` — React hooks and providers
- `packages/cli` — command-line tools
- `examples` — integration examples
- `docs` — developer and operational documentation

Root command coverage: `pnpm build` builds SDK, SDK React, CLI, and web; `pnpm test` runs Vitest suites for those four packages; `pnpm lint` runs SDK and web lint; and `pnpm typecheck` builds SDK, SDK React, and CLI before checking TypeScript across the workspaces. Run `go build -v .`, `go vet ./...`, and `go test ./...` separately from `indexer`.
