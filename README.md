<p align="center">
  <img src="https://trustrove.vercel.app/og-image.png" alt="TrusTrove" width="600" />
</p>

<h1 align="center">TrusTrove</h1>

<p align="center">
  Decentralized trade finance on Stellar — SMEs get paid today, LPs earn yield, no banks involved.
</p>

<p align="center">
  <a href="https://github.com/TrusTrove/TrusTrove-app/actions/workflows/ci.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/TrusTrove/TrusTrove-app/ci.yml?branch=main&label=build" />
  </a>
  <img src="https://img.shields.io/badge/network-Stellar%20Testnet-00c9a7" />
  <img src="https://img.shields.io/badge/deployed-vercel-black" />
  <img src="https://img.shields.io/github/license/TrusTrove/TrusTrove-app" />
</p>

<p align="center">
  <a href="https://trustrove.vercel.app">Live App</a> ·
  <a href="https://github.com/TrusTrove/TrusTrove-contract">Smart Contracts</a> ·
  <a href="https://stellar.expert/explorer/testnet">Stellar Explorer</a>
</p>

---

## What is TrusTrove?

Small businesses that sell on credit terms wait 30–90 days to get paid. TrusTrove removes that wait.

An SME tokenizes their unpaid invoice on Stellar and receives immediate USDC from a shared liquidity pool at a small discount. The buyer repays the full invoice amount at the due date. Liquidity providers earn yield from those discount fees. Four Soroban smart contracts handle everything — no bank, no broker, no intermediary.

The Asian Development Bank estimates the global trade finance gap at $2.5 trillion annually. Most of it falls on SMEs in emerging markets who cannot access bank credit. TrusTrove runs on Stellar specifically because of its fast finality, low fees, USDC support, and anchor network for fiat on/off ramps.

---

## Maintainers

|     | Name                  | Role                     | GitHub                                     | Telegram                             |
| --- | --------------------- | ------------------------ | ------------------------------------------ | ------------------------------------ |
|     | **Fuhad (K1NGD4VID)** | Founder & Lead Developer | [@k1ngd4vid](https://github.com/k1ngd4vid) | [@k1ngd4vid](https://t.me/k1ngd4vid) |

Join the contributor community: **[t.me/trusttrove](https://t.me/trusttrove)**

---

## How It Works

```
SME creates invoice on-chain
       ↓
Lists for financing with a chosen discount rate
       ↓
Pool funds the invoice — SME receives USDC immediately
       ↓
Goods shipped → buyer confirms delivery
       ↓
Buyer repays face value at due date
       ↓
Yield distributes to LP shares
```

---

## Tech Stack

| Layer           | Technology                                                                                |
| --------------- | ----------------------------------------------------------------------------------------- |
| Smart Contracts | Rust, Soroban SDK — [TrusTrove-contract](https://github.com/TrusTrove/TrusTrove-contract) |
| Frontend        | Next.js 14, TypeScript, Tailwind CSS, Framer Motion                                       |
| Wallet          | Freighter browser extension                                                               |
| Payments        | USDC on Stellar                                                                           |
| SDK             | Custom TypeScript contract client wrappers                                                |
| Indexer         | Go 1.22, chi router, pgx v5                                                               |
| Database        | PostgreSQL 15                                                                             |
| Hosting         | Vercel (frontend), Render (indexer + database)                                            |

---

## Deployed Contracts (Stellar Testnet)

| Contract          | Address                                                    |
| ----------------- | ---------------------------------------------------------- |
| registry_contract | `CABGWVIZFF62FG67ZGFEP67NEEY4WYTMFURDMFTKKNRDAFPKPOJDTN4C` |
| invoice_contract  | `CA4O3MR7LWHRSUDBNU6FY6UDFFYBN7TGBZXBDZB4OYYXFYXIFJ6RJF6B` |
| escrow_contract   | `CAJWGUKDTTC3SKN4RAAY72J4DVIIYSCFHX6GIMNTT22ABMISJK4GBCEH` |
| pool_contract     | `CAKEWH7SJCXGV2MH2WZYIX3QDPTSSBQFXYVYBOWAGLNBBZMPLE2US6CS` |

---

## Configuration and API documentation

- Root [`.env.example`](./.env.example) is the single source of truth for frontend, SDK, and Go indexer variables. It lists each variable's layer, type, required status, default value, description, and source.
- For Render deployments, set `ALLOWED_ORIGINS` to `https://trustrove.vercel.app,http://localhost:3000` so the indexer accepts requests only from the production Vercel domain and local development origins.
- Indexer OpenAPI documentation lives at [`docs/openapi/indexer.yaml`](./docs/openapi/indexer.yaml), including health, SEP-10 auth, invoices, events, stats, and pool endpoints.
- Web app setup instructions live at [`apps/web/README.md`](./apps/web/README.md).

---

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Go 1.22+
- Docker
- [Freighter](https://freighter.app) browser extension

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

The contract IDs are pre-filled with the deployed testnet addresses. Review `.env.example` for every frontend, SDK, and indexer variable before changing networks.

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

---

## Contributing

We welcome contributions from the Stellar community. Before opening a PR, please read [CONTRIBUTING.md](./CONTRIBUTING.md).

### Find an issue

Browse open issues labeled by complexity:

- `complexity:low` — isolated scope, good starting point
- `complexity:medium` — touches 2–3 components
- `complexity:high` — architectural changes

### Branch naming

- Features: `feat/123-short-description`
- Fixes: `fix/456-short-description`
- Docs: `docs/short-description`

### Commit format

We use Conventional Commits:

```
feat(web): add invoice status timeline component
fix(sdk): handle soroban rpc timeout with retry
docs(indexer): add pagination endpoint documentation
```

### PR process

1. Assign yourself to the issue before starting
2. Branch from `main`
3. Open a draft PR early so maintainers can give early feedback
4. All checks must pass before review

If you have questions, reach us on Telegram: **[t.me/trusttrove](https://t.me/trusttrove)**

---

## License

MIT

---

## Contributors

[![Contributors](https://contrib.rocks/image?repo=TrusTrove/TrusTrove-app)](https://github.com/TrusTrove/TrusTrove-app/graphs/contributors)
