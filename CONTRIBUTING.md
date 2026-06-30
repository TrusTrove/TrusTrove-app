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
- [ ] Linting passes (`pnpm --filter web lint` / `go vet ./...`)
- [ ] All existing and new tests pass (`pnpm test` / `go test ./...`)
- [ ] No `TODO`, stub, or placeholder code is present
- [ ] TypeScript changes use strict types (no `any`)
- [ ] New Go code is formatted with `gofmt`
- [ ] Commit messages follow Conventional Commits format
- [ ] PR description explains the change, why it is needed, and how it was tested

---

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
# Compile SDK and Next.js frontend
pnpm install
pnpm build

# Compile Go Indexer
cd indexer
go build -v .
```

### 2. Linting & Code Quality

Run linters on edited workspace directories:

```bash
# Web application lint
pnpm --filter web lint

# Go linter
cd indexer
go vet ./...
```

### 3. Testing

Ensure all tests pass before submitting code:

```bash
# Run all workspace tests
pnpm test

# Run frontend tests only
pnpm --filter web test

# Run SDK tests only
pnpm --filter @trusttrove/sdk test

# Run Go indexer tests
cd indexer && go test ./...
```

Example output (all passing):

```text
> pnpm test
...
Test Suites: 12 passed, 12 total
Tests:       47 passed, 47 total
Time:        2.34 s
ok  	github.com/trusttrove/indexer	0.876s
```

---
