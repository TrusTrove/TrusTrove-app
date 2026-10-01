# Local Setup

Follow these steps to set up the TrusTrove repository locally.

### Prerequisites

- Node.js 20+
- pnpm 9+
- Go 1.25+
- Docker
- Freighter browser extension installed

### 1. Clone and install

```bash
git clone https://github.com/TrusTrove/TrusTrove-app.git
cd TrusTrove-app
pnpm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

The contract IDs are pre-filled with the deployed testnet addresses. No changes needed to run locally.

### 3. Start PostgreSQL

```bash
docker-compose up -d
```

### 4. Run indexer database migrations

Database migrations are run automatically when the indexer starts. No manual migration steps are needed.

Migrations are stored in `indexer/db/migrations` and follow a forward-only convention (files named `NNN_name.sql`). The indexer tracks applied migrations in a `schema_migrations` table and only applies migrations that have not yet been run.

If you need to roll back database changes (e.g., to reset your local development database):

```bash
# Destroy and recreate the database container
docker-compose down -v
docker-compose up -d
```

This approach is recommended over manual SQL operations, as it ensures a clean slate without risk of partial state.

### 5. Start the indexer

```bash
cd indexer
go run main.go
```

### 6. Start the frontend

```bash
pnpm --filter web dev
```

Open [http://localhost:3000](http://localhost:3000), connect Freighter on testnet, and get testnet USDC from [demo.stellar.org](https://demo.stellar.org).

### 7. Build and test

```bash
pnpm build             # SDK + web app
pnpm test               # SDK + web app unit tests
cd indexer && go test ./...   # Go indexer unit tests
```

## Analyzing the frontend bundle

The web app is wired up with [`@next/bundle-analyzer`](https://www.npmjs.com/package/@next/bundle-analyzer) so bundle bloat can be spotted before it ships, instead of only when someone manually audits `apps/web/package.json`.

```bash
pnpm --filter web analyze
```

That runs a production `next build` with `ANALYZE=true` and writes one interactive treemap per bundle to `apps/web/.next/analyze/`:

| File          | Covers                            |
| ------------- | --------------------------------- |
| `client.html` | JavaScript shipped to the browser |
| `nodejs.html` | The Node.js server runtime bundle |
| `edge.html`   | The edge runtime bundle           |

Open `apps/web/.next/analyze/client.html` in a browser — that is the one that determines what users download. Add `ANALYZE_OPEN=true` to have the reports opened automatically:

```bash
ANALYZE=true ANALYZE_OPEN=true pnpm --filter web build
```

Analysis is strictly opt-in: without `ANALYZE=true`, `pnpm build` and `pnpm --filter web dev` behave exactly as before.

What to look for:

- A dependency in the treemap that no longer appears in any `import` — a leftover that should be removed from `package.json`.
- A single package dominating a shared chunk — usually a candidate for a dynamic `import()` so it only loads on the route that needs it.
- A chunk that grew noticeably against the previous run — worth explaining in the PR that caused it.

## Database migrations

Indexer migrations are stored in `indexer/db/migrations` and use a forward-only migration system. Migration files are named using the `NNN_name.sql` convention (e.g., `001_initial.sql`, `002_add_indexes.sql`).

The indexer automatically applies pending migrations on startup by:

1. Reading migration files from the `indexer/db/migrations` directory
2. Tracking applied migrations in a `schema_migrations` table
3. Executing only migrations that have not yet been applied

### One number per migration

Every migration gets its own number. Files are applied in filename order and recorded by their full name, so two files that share a number both run, in whatever order their descriptions happen to sort. That is how the `002_` and `009_` collisions reached `main`.

- **Name:** `NNN_lowercase_description.sql`, matching `^\d{3}_[a-z0-9_]+\.sql$`: three digits, an underscore, then lowercase letters, digits and underscores (for example `011_add_invoice_currency.sql`).
- **Numbering:** numbers run `001`, `002`, `003`, ... with no gaps and no reuse. Use the highest number on `main` plus one.
- **Check right before merging:** another PR may have taken your number since you branched. Rebase on the latest `main` and confirm the number is still free.
- **If two PRs pick the same number:** whichever merges second rebases and renumbers its migration to the next free number. Never edit or renumber a migration that is already on `main`; databases have recorded it by name.

Two checks enforce this:

- `TestMigrationsDir_NamesAreValid` (`indexer/db`, runs with `go test ./...`, no database needed) fails on a duplicate number, a name that doesn't match the pattern, or a gap in the sequence.
- On startup, `RunMigration` refuses to apply anything if two files share a number or a name doesn't match the pattern, for example: `duplicate migration number 011: 011_add_a.sql, 011_add_b.sql (each migration needs a unique NNN_ prefix)`. A gap does not stop the indexer.

The existing `009_add_webhook_subscriptions.sql` / `009_webhooks.sql` pair is the only tolerated duplicate, listed in `knownDuplicateMigrations` in `indexer/db/migration_names.go` until [#880](https://github.com/TrusTrove/TrusTrove-app/issues/880) resolves it. Don't add entries there; renumber the new migration instead.

Two PRs can each pass CI on their own and still collide once both merge. Requiring branches to be up to date before merging (or using a merge queue) makes the check run against the combined result.

### Rolling back database changes

The indexer uses a forward-only migration system with no down-migration scripts. To roll back changes or reset your local database:

```bash
# Destroy and recreate the database container (cleans everything)
docker-compose down -v
docker-compose up -d

# The indexer will re-apply all migrations on next startup
```

This is the recommended approach for local development. For manual intervention on a running database, you can:

- Connect to the database and drop/recreate objects as needed
- Run custom SQL against `$DATABASE_URL` using `psql`

For production databases, always back up data before making any manual changes.
