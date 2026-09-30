# Environment Variables

| Variable                           | Where needed       | Description                              | Example                                              |
| ---------------------------------- | ------------------ | ---------------------------------------- | ---------------------------------------------------- |
| `NEXT_PUBLIC_STELLAR_NETWORK`      | Frontend + Backend | Network name                             | `testnet`                                            |
| `NEXT_PUBLIC_HORIZON_URL`          | Frontend + Backend | Horizon REST API endpoint                | `https://horizon-testnet.stellar.org`                |
| `NEXT_PUBLIC_SOROBAN_RPC_URL`      | Frontend + Backend | Soroban RPC endpoint                     | `https://soroban-testnet.stellar.org`                |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE`   | Frontend + Backend | Stellar network passphrase               | `Test SDF Network ; September 2015`                  |
| `NEXT_PUBLIC_REGISTRY_CONTRACT_ID` | Frontend + Backend | Deployed registry contract address       | `CABG...`                                            |
| `NEXT_PUBLIC_INVOICE_CONTRACT_ID`  | Frontend + Backend | Deployed invoice contract address        | `CA4O...`                                            |
| `NEXT_PUBLIC_ESCROW_CONTRACT_ID`   | Frontend + Backend | Deployed escrow contract address         | `CAJW...`                                            |
| `NEXT_PUBLIC_POOL_CONTRACT_ID`     | Frontend + Backend | Deployed pool contract address           | `CAKE...`                                            |
| `NEXT_PUBLIC_AGENT_REGISTRY_CONTRACT_ID` | Frontend only | Frontend twin of `AGENT_REGISTRY_CONTRACT` (Underwrite's agent-registry contract; leave empty until it is deployed) | _(empty)_ |
| `NEXT_PUBLIC_USDC_ISSUER`          | Frontend + Backend | USDC issuer on Stellar testnet           | `GBBD...`                                            |
| `NEXT_PUBLIC_USDC_ASSET_CODE`      | Frontend + Backend | USDC asset code                          | `USDC`                                               |
| `NEXT_PUBLIC_API_BASE_URL`         | Frontend only      | Indexer API base URL                     | `http://localhost:8080`                              |
| `NEXT_PUBLIC_APP_URL`              | Frontend only      | Base URL used to build absolute links (e.g. shared invoice URLs) when the request origin is unavailable | `http://localhost:3000` |
| `STELLAR_NETWORK`                  | Backend only       | Network name                             | `testnet`                                            |
| `HORIZON_URL`                      | Backend only       | Horizon REST API endpoint                | `https://horizon-testnet.stellar.org`                |
| `SOROBAN_RPC_URL`                  | Backend only       | Soroban RPC endpoint                     | `https://soroban-testnet.stellar.org`                |
| `NETWORK_PASSPHRASE`               | Backend only       | Stellar network passphrase               | `Test SDF Network ; September 2015`                  |
| `REGISTRY_CONTRACT_ID`             | Backend only       | Deployed registry contract address       | `CABG...`                                            |
| `INVOICE_CONTRACT_ID`              | Backend only       | Deployed invoice contract address        | `CA4O...`                                            |
| `ESCROW_CONTRACT_ID`               | Backend only       | Deployed escrow contract address         | `CAJW...`                                            |
| `POOL_CONTRACT_ID`                 | Backend only       | Deployed pool contract address           | `CAKE...`                                            |
| `AGENT_REGISTRY_CONTRACT`          | Backend only       | Deployed agent-registry contract address | `CABC...`                                            |
| `USDC_ISSUER`                      | Backend only       | USDC issuer on Stellar testnet           | `GBBD...`                                            |
| `USDC_ASSET_CODE`                  | Backend only       | USDC asset code                          | `USDC`                                               |
| `DATABASE_URL`                     | Backend only       | Neon pooled connection string            | `postgresql://user:pass@host/db?sslmode=require`     |
| `DATABASE_URL_UNPOOLED`            | Backend only       | Neon direct connection string            | `postgresql://user:pass@host/db?sslmode=require`     |
| `TEST_DATABASE_URL`                | Backend only (tests) | Required for the DB integration tests in `indexer/db`; when unset, those tests `t.Skip` instead of failing | `postgresql://user:pass@localhost/db` |
| `API_PORT`                         | Backend only       | Indexer HTTP port (fallback: `PORT`, then `8080`) | `8080`                                          |
| `PORT`                             | Backend only       | Fallback for `API_PORT` (provided automatically by Render); ignored when `API_PORT` is set | `8080` |
| `INDEXER_POLL_INTERVAL_MS`         | Backend only       | Soroban event poll interval              | `5000`                                               |
| `INDEXER_MIGRATIONS_DIR`           | Backend only       | Overrides migration-directory auto-discovery (`locateMigrationDir` in `indexer/db/db.go`); set in CI when the binary runs from an unusual working directory | `./indexer/db/migrations` |
| `APP_ENV`                          | Backend only       | `development` (default) or `production`; in `production`, `JWT_SECRET` and `SERVER_SEED` become required instead of auto-generated (see below) | `production` |
| `JWT_SECRET`                       | Backend only       | Secret for JWT signing. Required in `production` (startup fails without it). Outside `production`, an empty value is silently replaced by a random secret, which invalidates all tokens on every restart | `your-secret-here` |
| `JWT_EXPIRY_HOURS`                 | Backend only       | JWT token expiry                         | `24`                                                 |
| `SERVER_SEED`                      | Backend only       | Stellar seed (starts with `S`) that signs the on-chain transactions for `POST /invoices`. Required in `production` (startup fails without it). Otherwise a random keypair is generated at startup, so relayed invoices come from a different account on every restart | `S...` |
| `RATE_LIMIT_RPS`                   | Backend only       | Per-client rate limit applied to `/auth`, the public read routes and `POST /invoices` (default `10`) | `10` |
| `SENTRY_DSN`                       | Backend only       | Enables Sentry error/panic reporting when set; leave empty to disable it entirely | `https://...@sentry.io/...` |
| `ALLOWED_ORIGINS`                  | Backend only       | Allowed CORS origins for the indexer API (fallback: `CORS_ALLOWED_ORIGINS`) | `https://trustrove.vercel.app,http://localhost:3000` |
| `CORS_ALLOWED_ORIGINS`             | Backend only       | Alternate name for `ALLOWED_ORIGINS`; only read when `ALLOWED_ORIGINS` is unset — set one or the other, not both | `https://trustrove.vercel.app` |
| `CI`                               | CI only            | Ambient flag set automatically by GitHub Actions and most CI providers (affects Playwright behavior); do not set by hand | _(empty)_ |

> **Note:** `AGENT_REGISTRY_CONTRACT` is deployed from Underwrite's separate `underwrite-contract` repo, not from this monorepo.

## Production requirements

When `APP_ENV=production`, the indexer refuses to start unless these are set
(`indexer/config/config.go` treats them as required instead of auto-generating
fallbacks):

- `JWT_SECRET` — without it, every restart mints a new random secret and all
  previously issued tokens stop validating.
- `SERVER_SEED` — without it, every restart generates a new random keypair, so
  invoices relayed via `POST /invoices` are submitted from a different Stellar
  account each time.

Everything else keeps its documented default in production unless you override it.

## Source of truth

- **Local dev (backend):** Root `.env.local` (loaded by godotenv)
- **Local dev (frontend):** `apps/web/.env.local` (loaded by Next.js)
- **Production (backend):** Render dashboard → Environment Variables
- **Production (frontend):** Vercel dashboard → Environment Variables

## Database

The project uses **Neon Serverless Postgres** for the database. The connection string is managed via `neonctl`:

```bash
# Pull latest Neon env vars into .env.local
npx neonctl env pull
```

This updates `DATABASE_URL` and `DATABASE_URL_UNPOOLED` with the correct credentials. Never hardcode these in `.env` or commit them to git.
