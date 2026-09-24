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
pnpm build             # SDK + CLI + web app
pnpm test               # SDK + SDK-React + CLI + web app unit tests
cd indexer && go test ./...   # Go indexer unit tests
```

## Full local stack with Docker Compose

[docker-compose.yml](../../docker-compose.yml) can run the whole stack — Postgres, the Go indexer (built from `indexer/Dockerfile`), and the Next.js web app (built from `apps/web/Dockerfile`) — so no Go or Node toolchain is needed on the host.

1. Create the Compose-specific env file:

   ```bash
   cp .env.docker.example .env.docker
   ```

   It mirrors the root `.env.example`, with the values the Compose network changes: `DATABASE_URL` points at the `db` service hostname instead of `localhost`, and `INDEXER_MIGRATIONS_DIR` points at the migrations path baked into the indexer image. `.env.docker` is git-ignored.

2. Build and start everything:

   ```bash
   docker compose --env-file .env.docker up --build
   ```

   `--env-file` supplies the web image's `NEXT_PUBLIC_*` build args, and the same file is loaded into the `indexer` and `web` containers via `env_file`.

3. Open [http://localhost:3000](http://localhost:3000). The indexer API listens on [http://localhost:8080](http://localhost:8080) and serves `/health`.

Useful commands:

```bash
docker compose up -d db         # Postgres only (the workflow above)
docker compose logs -f indexer  # follow indexer/API logs
docker compose down             # stop the stack
docker compose down -v          # stop the stack and delete the Postgres volume
```

`.env.docker` is optional: if it does not exist, the `indexer` and `web` services are skipped in practice and `docker compose up -d db` keeps working for the non-Docker workflow.

## Command-line interface

`@trusttrove/cli` (`packages/cli`) wraps the SDK's read-only contract calls:

```bash
pnpm --filter @trusttrove/cli build
node packages/cli/dist/index.js list-invoices --status Funded --public-key <G...>
node packages/cli/dist/index.js list-invoices --issuer <G...> --public-key <G...>
```

`--public-key` falls back to `TRUSTTROVE_PUBLIC_KEY` and `--contract-id` to `INVOICE_CONTRACT_ID`, so once those are set in your `.env.local` (see step 2) the flags can be omitted.

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
