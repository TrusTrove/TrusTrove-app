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

### 4. Start the indexer

```bash
cd indexer
go run main.go
```

### 5. Start the frontend

```bash
pnpm --filter web dev
```

Open [http://localhost:3000](http://localhost:3000), connect Freighter on testnet, and get testnet USDC from [demo.stellar.org](https://demo.stellar.org).

## Database migrations

Indexer migrations are stored in `indexer/db/migrations`. Each migration uses a matching pair of files:

- `NNN_name.sql` — applies the migration.
- `NNN_name.down.sql` — rolls the migration back.

For example, the initial schema is applied with:

```bash
cd indexer
psql "$DATABASE_URL" -f db/migrations/001_initial.sql
```

To roll back that migration:

```bash
psql "$DATABASE_URL" -f db/migrations/001_initial.down.sql
```

Run rollback scripts only when intentionally reverting a migration. They remove the database objects created by the corresponding forward migration, so verify the target database and take a backup before running them in a shared or production environment.
