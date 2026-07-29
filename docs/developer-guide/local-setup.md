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

Migrations are stored in `indexer/db/migrations`. Forward migrations use the existing `NNN_name.sql` convention, and each forward migration has a matching `NNN_name.down.sql` rollback script.

Apply the initial schema with:

```bash
cd indexer
psql "$DATABASE_URL" -f db/migrations/001_initial.sql
```

To roll back the initial schema, run the matching down migration. This is destructive and removes the tables created by the initial migration:

```bash
psql "$DATABASE_URL" -f db/migrations/001_initial.down.sql
```

Always review a down migration before running it against a shared or production database.

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

Indexer migrations are stored in `indexer/db/migrations`. Each migration has a forward file and a matching rollback file using the `NNN_name.sql` and `NNN_name.down.sql` naming convention. The initial migration is `001_initial.sql`, with rollback migration `001_initial.down.sql`.

Apply the initial schema with:

```bash
psql "$DATABASE_URL" -f indexer/db/migrations/001_initial.sql
```

To roll back the initial schema, run the matching down migration:

```bash
psql "$DATABASE_URL" -f indexer/db/migrations/001_initial.down.sql
```

Run rollback migrations only when you intend to remove the objects created by the corresponding forward migration. Back up production data before rolling back a migration.
