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
cp .env.docker.example .env.docker   # for the Docker Compose stack below
cp .env.example .env.local           # only needed for the manual run path
```

The contract IDs are pre-filled with the deployed testnet addresses. No changes needed to run locally.

- `.env.docker` feeds the containerized indexer through Docker Compose (see below).
- `.env.local` is the shared source of truth for host-run processes (`go run main.go`, `pnpm --filter web dev`) and is documented in [`.env.example`](../../.env.example).

### 3. Bring up the full local stack (recommended)

Docker Compose runs the entire stack — database, indexer, and web app — with one command:

```bash
docker compose up -d --build
```

This builds three services:

| Service   | Image / source                     | Exposed port | Path for you to use                                        |
| --------- | ---------------------------------- | ------------ | ---------------------------------------------------------- |
| `db`      | `postgres:15-alpine`               | `5432`       | `postgresql://postgres:postgres@localhost:5432/trusttrove` |
| `indexer` | `indexer/Dockerfile` (Go 1.25)     | `8080`       | `http://localhost:8080`                                    |
| `web`     | `apps/web/Dockerfile` (Next.js 20) | `3000`       | `http://localhost:3000`                                    |

Database migrations are applied automatically by the indexer when it starts, so no manual migration steps are needed. On the first boot you will see the indexer log the migrations it applied before the API begins serving.

Open [http://localhost:3000](http://localhost:3000), connect Freighter on testnet, and get testnet USDC from [demo.stellar.org](https://demo.stellar.org).

Managing the stack:

```bash
# Stop everything (containers stopped, data volume preserved)
docker compose down

# Rebuild and restart after code changes
docker compose up -d --build

# Rebuild a single service only
docker compose up -d --build indexer

# Follow logs
docker compose logs -f
```

### Alternative: run services manually

For contributors iterating on indexer or web code directly, run the processes on the host instead of in containers:

### 4. Start PostgreSQL

```bash
docker compose up -d db
```

### 5. Start the indexer

Database migrations are run automatically when the indexer starts. No manual migration steps are needed.

Migrations are stored in `indexer/db/migrations` and follow a forward-only convention (files named `NNN_name.sql`). The indexer tracks applied migrations in a `schema_migrations` table and only applies migrations that have not yet been run.

```bash
cd indexer
go run main.go
```

### 6. Start the frontend

```bash
pnpm --filter web dev
```

### 7. Build and test

```bash
pnpm build             # SDK + web app
pnpm test               # SDK + web app unit tests
cd indexer && go test ./...   # Go indexer unit tests
```

## Database migrations

Indexer migrations are stored in `indexer/db/migrations` and use a forward-only migration system. Migration files are named using the `NNN_name.sql` convention (e.g., `001_initial.sql`, `002_add_indexes.sql`).

The indexer automatically applies pending migrations on startup by:

1. Reading migration files from the `indexer/db/migrations` directory
2. Tracking applied migrations in a `schema_migrations` table
3. Executing only migrations that have not yet been applied

Running the full stack with Docker Compose does all of this for you; the `db` volume persists between `docker compose down` / `docker compose up`, so your schema and data survive restarts.

### Rolling back database changes

The indexer uses a forward-only migration system with no down-migration scripts. To roll back changes or reset your local database:

```bash
# Destroy and recreate the database volume (cleans everything)
docker compose down -v
docker compose up -d --build

# For the manual path only: the container itself is disposable too
docker compose up -d db
docker compose down -v
docker compose up -d db
# The indexer will re-apply all migrations on next startup
```

This is the recommended approach for local development. For manual intervention on a running database, you can:

- Connect to the database and drop/recreate objects as needed
- Run custom SQL against `$DATABASE_URL` using `psql`

For production databases, always back up data before making any manual changes.
