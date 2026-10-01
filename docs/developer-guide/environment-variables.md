# Environment Variables

| Variable                                  | Where needed       | Description                                                        | Example                                              |
| ----------------------------------------- | ------------------ | ------------------------------------------------------------------ | ---------------------------------------------------- |
| `NEXT_PUBLIC_STELLAR_NETWORK`             | Frontend + Backend | Network name                                                       | `testnet`                                            |
| `NEXT_PUBLIC_HORIZON_URL`                 | Frontend + Backend | Horizon REST API endpoint                                          | `https://horizon-testnet.stellar.org`                |
| `NEXT_PUBLIC_SOROBAN_RPC_URL`             | Frontend + Backend | Soroban RPC endpoint                                               | `https://soroban-testnet.stellar.org`                |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE`          | Frontend + Backend | Stellar network passphrase                                         | `Test SDF Network ; September 2015`                  |
| `NEXT_PUBLIC_REGISTRY_CONTRACT_ID`        | Frontend + Backend | Deployed registry contract address                                 | `CABG...`                                            |
| `NEXT_PUBLIC_INVOICE_CONTRACT_ID`         | Frontend + Backend | Deployed invoice contract address                                  | `CA4O...`                                            |
| `NEXT_PUBLIC_ESCROW_CONTRACT_ID`          | Frontend + Backend | Deployed escrow contract address                                   | `CAJW...`                                            |
| `NEXT_PUBLIC_POOL_CONTRACT_ID`            | Frontend + Backend | Deployed pool contract address                                     | `CAKE...`                                            |
| `NEXT_PUBLIC_AGENT_REGISTRY_CONTRACT_ID`  | Frontend + Backend | External Underwrite agent-registry address (optional until deployed) | empty                                              |
| `NEXT_PUBLIC_USDC_ISSUER`                 | Frontend + Backend | USDC issuer on Stellar testnet                                     | `GBBD...`                                            |
| `NEXT_PUBLIC_USDC_ASSET_CODE`             | Frontend + Backend | USDC asset code                                                    | `USDC`                                               |
| `NEXT_PUBLIC_API_BASE_URL`                | Frontend only      | Indexer API base URL                                               | `http://localhost:8080`                              |
| `NEXT_PUBLIC_APP_URL`                     | Frontend only      | Base URL used to build absolute links (e.g. shared invoice URLs)  | `http://localhost:3000`                              |
| `STELLAR_NETWORK`                         | Backend only       | Network name                                                       | `testnet`                                            |
| `HORIZON_URL`                             | Backend only       | Horizon REST API endpoint                                          | `https://horizon-testnet.stellar.org`                |
| `SOROBAN_RPC_URL`                         | Backend only       | Soroban RPC endpoint                                               | `https://soroban-testnet.stellar.org`                |
| `NETWORK_PASSPHRASE`                      | Backend only       | Stellar network passphrase                                         | `Test SDF Network ; September 2015`                  |
| `REGISTRY_CONTRACT_ID`                    | Backend only       | Deployed registry contract address                                 | `CABG...`                                            |
| `INVOICE_CONTRACT_ID`                     | Backend only       | Deployed invoice contract address                                  | `CA4O...`                                            |
| `ESCROW_CONTRACT_ID`                      | Backend only       | Deployed escrow contract address                                   | `CAJW...`                                            |
| `POOL_CONTRACT_ID`                        | Backend only       | Deployed pool contract address                                     | `CAKE...`                                            |
| `AGENT_REGISTRY_CONTRACT`                 | Backend only       | Deployed agent-registry contract address                           | `CABC...`                                            |
| `USDC_ISSUER`                             | Backend only       | USDC issuer on Stellar testnet                                     | `GBBD...`                                            |
| `USDC_ASSET_CODE`                         | Backend only       | USDC asset code                                                    | `USDC`                                               |
| `DATABASE_URL`                            | Backend only       | Neon pooled connection string                                      | `postgresql://user:pass@host/db?sslmode=require`     |
| `DATABASE_URL_UNPOOLED`                   | Backend only       | Neon direct connection string                                      | `postgresql://user:pass@host/db?sslmode=require`     |
| `TEST_DATABASE_URL`                       | Backend only (test) | Disposable Postgres for DB integration tests; when unset those tests skip | empty                                        |
| `API_PORT`                                | Backend only       | Indexer HTTP port (fallback: `PORT`)                               | `8080`                                               |
| `PORT`                                    | Backend only       | PaaS-provided port (e.g. Render); used when `API_PORT` is unset    | `10000`                                              |
| `INDEXER_POLL_INTERVAL_MS`                | Backend only       | Soroban event poll interval                                        | `5000`                                               |
| `INDEXER_MIGRATIONS_DIR`                  | Backend only       | Overrides migration directory discovery (usually auto-detected)    | `indexer/db/migrations`                              |
| `APP_ENV`                                 | Backend only       | Environment name; `production` makes `JWT_SECRET` and `SERVER_SEED` mandatory | `development`                              |
| `JWT_SECRET`                              | Backend only       | Secret for JWT signing. Outside production an empty value is replaced by a random secret at startup, which invalidates all tokens on restart | `your-secret-here` |
| `JWT_EXPIRY_HOURS`                        | Backend only       | JWT token expiry                                                   | `24`                                                 |
| `SERVER_SEED`                             | Backend only       | Stellar keypair seed that signs `POST /invoices`. Outside production an empty value generates a random keypair (relayed invoices then come from a different account on every restart) | `S...` |
| `ALLOWED_ORIGINS`                         | Backend only       | Allowed CORS origins for the indexer API                           | `https://trustrove.vercel.app,http://localhost:3000` |
| `CORS_ALLOWED_ORIGINS`                    | Backend only       | Alternate name for `ALLOWED_ORIGINS`; read only when that is unset | `https://trustrove.vercel.app`                       |
| `RATE_LIMIT_RPS`                          | Backend only       | Per-client rate limit for `/auth`, `/invoices` and public reads    | `10`                                                 |
| `WEBHOOK_WORKER_CONCURRENCY`              | Backend only       | Webhook deliveries attempted in parallel per claimed batch         | `8`                                                  |
| `SENTRY_DSN`                              | Backend only       | Enables Sentry panic reporting when set; empty disables it         | `https://...@sentry.io/...`                          |
| `CI`                                      | Ambient (CI only)  | Set automatically by GitHub Actions; leave unset in `.env.local`   | `true`                                               |

> **Note:** `AGENT_REGISTRY_CONTRACT` (and its frontend twin `NEXT_PUBLIC_AGENT_REGISTRY_CONTRACT_ID`) is deployed from Underwrite's separate `underwrite-contract` repo, not from this monorepo.

## Production requirements

When `APP_ENV=production`:

- `JWT_SECRET` is **required** — an empty value is a startup error instead of the random fallback used in development.
- `SERVER_SEED` is **required** — an empty value is a startup error instead of the auto-generated keypair used in development.
- All other variables marked "Required" in `.env.example` (network, contract IDs, `DATABASE_URL`, etc.) must be set as well.

Outside production, both secrets are generated automatically. The generated values change on every restart, so tokens are invalidated and relayed invoices are signed by a fresh account each time — always set real values for any long-lived environment.

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
