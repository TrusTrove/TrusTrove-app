# TrusTrove

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

Root command coverage: `pnpm build` builds SDK, SDK React, CLI, and web; `pnpm test` runs SDK, SDK React, and web Vitest suites; `pnpm lint` covers web only; and `pnpm typecheck` checks all TypeScript workspaces. Run `go build -v .`, `go vet ./...`, and `go test ./...` separately from `indexer`.
