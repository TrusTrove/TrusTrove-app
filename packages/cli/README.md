# `@trusttrove/cli`

Command-line interface for interacting with TrusTrove Soroban contracts on Stellar.

## Commands

### `trusttrove check-pool-balance`

Fetch and print pool balance stats (`totalDeposits`, `availableLiquidity`, `utilizationRateBps`, `totalYieldDistributed`) along with the queried RPC URL and network passphrase.

Options:
- `--public-key <key>` — Stellar public key for the read-only simulation (or set `TRUSTTROVE_PUBLIC_KEY`)
- `--pool-contract-id <id>` — Pool contract ID (or set `TRUSTTROVE_POOL_CONTRACT_ID`, `NEXT_PUBLIC_POOL_CONTRACT_ID`, `POOL_CONTRACT_ID`)
- `--rpc-url <url>` — Soroban RPC URL (or set `TRUSTTROVE_RPC_URL`; falls back to SDK default)
- `--network-passphrase <passphrase>` — Stellar network passphrase (or set `TRUSTTROVE_NETWORK_PASSPHRASE`; falls back to SDK default)

### `trusttrove list-invoices`

List invoices from the invoice contract filtered by `--status <status>` or `--issuer <address>`.

Options:
- `--status <status>` — Filter by invoice status (`Created`, `Listed`, `Funded`, `Active`, `Confirmed`, `Repaid`, `Defaulted`)
- `--issuer <address>` — Filter by issuer Stellar address
- `--public-key <key>` — Stellar public key for the read-only simulation (or set `TRUSTTROVE_PUBLIC_KEY`)
- `--contract-id <id>` — Invoice contract ID (or set `INVOICE_CONTRACT_ID`)

## Environment variables

| Variable | Used by | Description |
| --- | --- | --- |
| `TRUSTTROVE_PUBLIC_KEY` | `check-pool-balance`, `list-invoices` | Stellar public key for read-only simulations |
| `TRUSTTROVE_POOL_CONTRACT_ID` | `check-pool-balance` | Pool contract ID (highest env precedence) |
| `TRUSTTROVE_RPC_URL` | `check-pool-balance` | Soroban RPC endpoint URL |
| `TRUSTTROVE_NETWORK_PASSPHRASE` | `check-pool-balance` | Stellar network passphrase |
| `POOL_CONTRACT_ID` | `check-pool-balance` | Fallback pool contract ID |
| `INVOICE_CONTRACT_ID` | `list-invoices` | Invoice contract ID |
