# Environment Variables

| Variable                           | Where needed       | Description                              | Example                                              |
| ---------------------------------- | ------------------ | ---------------------------------------- | ---------------------------------------------------- |
| `NEXT_PUBLIC_STELLAR_NETWORK`      | Frontend + SDK     | Network name                             | `testnet`                                            |
| `NEXT_PUBLIC_HORIZON_URL`          | Frontend + SDK     | Horizon REST API endpoint                | `https://horizon-testnet.stellar.org`                |
| `NEXT_PUBLIC_SOROBAN_RPC_URL`      | Frontend + SDK     | Soroban RPC endpoint                     | `https://soroban-testnet.stellar.org`                |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE`   | Frontend + SDK     | Stellar network passphrase               | `Test SDF Network ; September 2015`                  |
| `NEXT_PUBLIC_REGISTRY_CONTRACT_ID` | Frontend + SDK     | Deployed registry contract address       | `CABG...`                                            |
| `NEXT_PUBLIC_INVOICE_CONTRACT_ID`  | Frontend + SDK     | Deployed invoice contract address        | `CA4O...`                                            |
| `NEXT_PUBLIC_ESCROW_CONTRACT_ID`   | Frontend + SDK     | Deployed escrow contract address         | `CAJW...`                                            |
| `NEXT_PUBLIC_POOL_CONTRACT_ID`     | Frontend + SDK     | Deployed pool contract address           | `CAKE...`                                            |
| `NEXT_PUBLIC_USDC_ISSUER`          | Frontend + SDK     | USDC issuer on Stellar testnet           | `GBBD...`                                            |
| `NEXT_PUBLIC_USDC_ASSET_CODE`      | Frontend + SDK     | USDC asset code                          | `USDC`                                               |
| `NEXT_PUBLIC_API_BASE_URL`         | Frontend only      | Indexer API base URL                     | `http://localhost:8080`                              |
| `CSP_ENFORCE`                      | Frontend only      | Enforce the CSP (default: report-only)   | `true`                                               |
| `SOROBAN_RPC_URL`                  | Backend only       | Soroban RPC endpoint                     | `https://soroban-testnet.stellar.org`                |
| `NETWORK_PASSPHRASE`               | Backend only       | Stellar network passphrase               | `Test SDF Network ; September 2015`                  |
| `REGISTRY_CONTRACT_ID`             | Backend only       | Deployed registry contract address       | `CABG...`                                            |
| `INVOICE_CONTRACT_ID`              | Backend only       | Deployed invoice contract address        | `CA4O...`                                            |
| `ESCROW_CONTRACT_ID`               | Backend only       | Deployed escrow contract address         | `CAJW...`                                            |
| `POOL_CONTRACT_ID`                 | Backend only       | Deployed pool contract address           | `CAKE...`                                            |
| `DATABASE_URL`                     | Backend only       | PostgreSQL connection string             | `postgresql://user:pass@host/db?sslmode=require`     |
| `API_PORT`                         | Backend only       | Indexer HTTP port (fallback: `PORT`)     | `8080`                                               |
| `APP_ENV`                          | Backend only       | Runtime environment (`development` or `production`). Unknown values are rejected at startup. | `development` |
| `INDEXER_POLL_INTERVAL_MS`         | Backend only       | Soroban event poll interval              | `5000`                                               |
| `INDEXER_CONFIRMATION_DEPTH`       | Backend only       | Reorg buffer; ledgers behind tip (0=off) | `3`                                                  |
| `JWT_SECRET`                       | Backend only       | Secret for JWT signing                   | `your-secret-here`                                   |
| `JWT_EXPIRY_HOURS`                 | Backend only       | JWT token expiry                         | `24`                                                 |
| `ALLOWED_ORIGINS`                  | Backend only       | Allowed CORS origins for the indexer API | `https://trustrove.vercel.app,http://localhost:3000` |

> **Note:** `CSP_ENFORCE` is read by the web app's middleware at request time, so it takes effect on restart or redeploy without a rebuild. See [Security Headers](security-headers.md).

> **Note:** `APP_ENV` accepts only `development` or `production`. Setting any other value (e.g. `prod`, `staging`) causes the indexer to refuse startup with an error. This prevents a misconfigured environment from silently falling back to development-mode secret generation in production.

> **Note:** Provider RPC URLs with embedded API keys are safe to use in `SOROBAN_RPC_URL`. Hosted Soroban RPC providers commonly authenticate via a key in the URL path or query string, and the indexer never echoes that URL to clients: transport errors from `CallSorobanRPC` are unwrapped to the operation name and underlying cause, and API handlers log backend errors server-side while responding with a generic message plus a request id (see issue #921).

## Source of truth

- **Local dev (backend):** Root `.env.local` (loaded by godotenv)
- **Local dev (frontend):** `apps/web/.env.local` (loaded by Next.js)
- **Production (backend):** Render dashboard → Environment Variables
- **Production (frontend):** Vercel dashboard → Environment Variables

## Database

The project uses **PostgreSQL** for the database. For local development, `docker-compose up` starts a Postgres container and `DATABASE_URL` in `.env.example` points to it. For production on Neon or Render Postgres, replace `DATABASE_URL` with the platform-provided pooled connection string.

