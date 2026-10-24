# Contributing to TrusTrove

Thank you for your interest in contributing to TrusTrove! To maintain code quality, security, and developer alignment across the monorepo, please adhere to the guidelines documented below.

---

## Code of Conduct & Standards

1. **No Placeholders or Stubs**: Do not submit code containing `TODO` comments, stub methods, or mock data (unless isolated to dedicated unit test fixtures). Every PR must contain fully functional, production-ready logic.
2. **Type Safety**:
   - **TypeScript**: Enforce strict typing. Do not use `any` unless absolutely necessary and documented.
   - **Go**: Write clean, idiomatically structured Go code. Use `gofmt` and address all compiler/lint warnings before committing.
3. **Security First**: Validate all user inputs on both the frontend (via Zod schemas) and backend (via parameter validation). Sign all write operations on-chain using the Freighter wallet API wrapper.

## Pull Request Checklist

Before opening or requesting review of a pull request, confirm the following:

- [ ] Code compiles without errors (`pnpm build` / `go build -v .`)
- [ ] TypeScript type-checking passes with no errors (`pnpm typecheck`)
- [ ] Linting passes (`pnpm --filter web lint` / `go vet ./...` and `golangci-lint run`)
- [ ] All existing and new tests pass (`pnpm test` / `go test -race ./...`)
- [ ] No `TODO`, stub, or placeholder code is present
- [ ] TypeScript changes use strict types (no `any`)
- [ ] New Go code is formatted with `gofmt`
- [ ] Commit messages follow Conventional Commits format
- [ ] PR description explains the change, why it is needed, and how it was tested

---

## Test command coverage

`pnpm build` covers `@trusttrove/sdk`, `@trusttrove/sdk-react`, `@trusttrove/cli`, and `web`. `pnpm test` runs the Vitest suites for those four packages; it does not run Go tests. `pnpm lint` covers SDK and web, while `pnpm typecheck` builds SDK, SDK React, and CLI before checking TypeScript across the workspaces.

Vitest reports `Test Files` and `Tests` (the counts vary by package and checkout). For example:

```text
> pnpm --filter web test

 Test Files  18 passed (18)
      Tests  126 passed (126)
   Start at  14:32:10
   Duration  8.42s
```

Go test output uses the module path `trusttrove/indexer` and its package paths. For example:

```text
> cd indexer && go test ./...
ok   trusttrove/indexer/api      0.412s
ok   trusttrove/indexer/config   0.018s
```

Database integration tests require `TEST_DATABASE_URL`; for Docker Compose use `postgresql://postgres:<POSTGRES_PASSWORD>@localhost:5432/trusttrove?sslmode=disable`, matching the `5432:5432` port mapping and the `trusttrove` database that `docker-compose.yml` creates and `.env.example` uses. Without that variable, those tests are skipped.

## Git Workflow Guidelines

We follow a strict, linear git history workflow to ensure codebase traceability.

1. **Atomic Commits**: Create one commit per logical unit of work. Do not bundle multiple unrelated changes (e.g. database schema changes and frontend styling updates) into a single commit.
2. **Never Use `git add .` or `git add -A`**: Proactively review and add files individually using:
   ```bash
   git add path/to/file.ext
   ```
3. **Commit & Push Early**: Push to your branch immediately after every local commit. This keeps remote builds in sync and facilitates continuous review.

### Commit Messages

Follow Conventional Commits format:

- `feat(web): add invoice listing cards`
- `fix(indexer): resolve database connection timeout`
- `docs: update setup documentation`
- `test(sdk): add registry client mock tests`

---

## Development Lifecycle

### 1. Build and Compile Verification

Verify compilation across all monorepo packages before submitting code:

```bash
# Build all TypeScript workspace packages
pnpm install
pnpm build

# Compile Go Indexer
cd indexer
go build -v .
```

### 2. Type-Checking

Run the TypeScript compiler in check-only mode across all packages:

```bash
pnpm typecheck
```

This runs `tsc --noEmit` recursively over every TypeScript package in the monorepo and reports type errors without emitting any output files. Fix all errors before opening a PR.

### 3. Linting & Code Quality

The root `pnpm lint` command lints the SDK and web workspaces. Run Go vet separately:

```bash
pnpm lint

# Go linter (static checks used by CI)
cd indexer
go vet ./...
golangci-lint run
```

`golangci-lint` runs the linters enabled in [`indexer/.golangci.yml`](indexer/.golangci.yml) (`errcheck`, `staticcheck`, `govet`, `ineffassign`, `unused`, `errorlint`) with a 5 minute timeout. Install it from <https://golangci-lint.run/welcome/install/> (CI pins the same version the workflow downloads), then run it from the `indexer/` directory. CI runs it on every pull request, so fix (or explicitly annotate with `//nolint:<linter> // <reason>`) every reported issue before opening a PR.

### 4. Testing

The test suite is split across two runtimes. Both must pass before opening a PR.

**TypeScript tests** (SDK, SDK React, CLI, and web, run from the repo root):

```bash
# Run all TypeScript workspace tests
pnpm test

# Run frontend tests only
pnpm --filter web test

# Run SDK tests only
pnpm --filter @trusttrove/sdk test
```

> **Note:** `pnpm test` runs the `@trusttrove/sdk`, `@trusttrove/sdk-react`, `@trusttrove/cli`, and web Vitest suites. It does **not** run Go tests.

**Go tests** (indexer, run from the `indexer/` directory):

```bash
cd indexer && go test -race ./...
```

**E2E tests** (Playwright, web app only):

The specs live in `apps/web/e2e/` and run in Chromium against the Next.js app. Every backend call (indexer API, Horizon, Soroban RPC) and the Freighter wallet are mocked inside the specs, so no indexer, database or browser extension is needed.

```bash
# One-time: download the Chromium build Playwright uses
# (on Linux, add --with-deps to also install the system libraries)
pnpm --filter web exec playwright install chromium

# The web app imports @trusttrove/sdk from its dist/ output
pnpm --filter @trusttrove/sdk build

# Run the whole suite (from the repo root, or `pnpm test:e2e` inside apps/web)
pnpm test:e2e

# Run a single spec, or a single test by title
pnpm test:e2e e2e/marketplace-browse.spec.ts
pnpm test:e2e -g "Dashboard renders key protocol stats"

# Watch the browser, or use the interactive UI mode
pnpm test:e2e --headed
pnpm test:e2e --ui

# Open the HTML report of the last run (written to apps/web/playwright-report/)
pnpm --filter web exec playwright show-report
```

Paths passed to `pnpm test:e2e` are relative to `apps/web`, because the root script delegates to the web workspace.

Locally, Playwright starts `next dev` on port 3000, or reuses a dev server that is already running there. With `CI` set, it runs `pnpm build && pnpm start` instead (a production build), which is how the **Web E2E Tests (Playwright)** job in `.github/workflows/ci.yml` runs on every pull request. To reproduce CI exactly, stop any running dev server and run:

```bash
CI=true pnpm test:e2e
```

`NEXT_PUBLIC_*` values are inlined at build time, so the build the specs run against must see them. CI sets the testnet `NEXT_PUBLIC_REGISTRY_CONTRACT_ID`, `NEXT_PUBLIC_INVOICE_CONTRACT_ID`, `NEXT_PUBLIC_POOL_CONTRACT_ID` and `NEXT_PUBLIC_ESCROW_CONTRACT_ID` on the build and E2E steps only (the same values as in `.env.example`; the SDK's unit tests expect them unset). Locally they come from your `.env.local` (repo root or `apps/web`) or the shell. The other `NEXT_PUBLIC_*` variables fall back to testnet defaults.

In CI the run uses one worker and retries a failing test twice, and the `github` reporter annotates failures on the pull request. If the job fails, download the `playwright-report` artifact from the workflow run, unzip it, and open it with `pnpm --filter web exec playwright show-report <unzipped-folder>`. Retried tests include a trace.

---
