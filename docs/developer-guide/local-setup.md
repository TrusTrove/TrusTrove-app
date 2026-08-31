# Local Setup

Follow these steps to set up the TrusTrove repository locally.

### Prerequisites

- Node.js 20+
- pnpm 9+
- Go 1.22+
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
