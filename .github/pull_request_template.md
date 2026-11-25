## Summary

<!--
Briefly describe what changed and why.
-->

Closes #

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Refactoring / chore

## Pull Request Checklist

### General

- [ ] PR title follows Conventional Commits format (`type(scope): description`)
- [ ] Linked to relevant issue(s) with `Closes #<number>`
- [ ] Description clearly explains what changed and why
- [ ] No secrets, keys, seed phrases, or `.env` files committed
- [ ] Documentation updated (if applicable)

### TypeScript (`apps/web`, `packages/sdk`, `packages/sdk-react`, `packages/cli`)

- [ ] `pnpm build` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (and `pnpm --filter @trusttrove/sdk test:coverage` meets thresholds: 70% lines/functions/statements, 50% branches)
- [ ] `pnpm test:e2e` passes (for web UI / routing changes)
- [ ] `npx prettier --check .` passes
- [ ] `pnpm audit --audit-level=high` passes

### Go Indexer & API (`indexer/`)

- [ ] `go build -v ./...` passes
- [ ] `go test -race ./...` passes (and `indexer/db` meets the 70% statement coverage threshold)
- [ ] `go vet ./...` and `golangci-lint run` pass
- [ ] `gofmt -l .` produces no unformatted files

### UI & Accessibility (if applicable)

- [ ] Screenshots / screen recordings attached for UI changes
- [ ] Accessibility and contrast (WCAG AA) checked in light and dark themes

### CI Gate

- [ ] All CI checks (`Verify TypeScript Frontend & SDK`, `Web E2E Tests (Playwright)`, `Verify Go Indexer & API`) and any required PR checks pass before requesting review

## How It Was Tested

<!--
Describe the commands run and any manual verification performed.
-->
