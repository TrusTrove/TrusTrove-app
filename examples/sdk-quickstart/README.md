# @trusttrove/sdk Quickstart

A minimal, runnable example showing how to use the `@trusttrove/sdk` against
Stellar **testnet**. It calls three read-only SDK methods and prints the
results to the console:

1. `RegistryClient.isVerified()` — is the sample address a verified registry member?
2. `PoolClient.getStats()` — current liquidity pool statistics.
3. `InvoiceClient.getByStatus()` — invoices currently listed on the marketplace.

The example is deliberately framework-free: it is a plain Node/TypeScript
script. The same testnet contract addresses from
[`docs/smart-contracts/overview.md`](../../docs/smart-contracts/overview.md)
are used as defaults.

## Prerequisites

- Node.js 20+
- pnpm 9+
- Network access to Stellar testnet (Horizon + Soroban RPC)

## Install

From the repository root:

```bash
pnpm install
```

This links the local `@trusttrove/sdk` workspace package into the example.

## Run

From the repository root:

```bash
pnpm --filter sdk-quickstart start
```

Example output:

```text
isVerified(GD4D4DIAFNEYB3NBC7T5WQEZQUXRWNQAWJXGWLNVVC6WUWNMIQLB5BGR) => false
Pool stats => { totalDeposits: 100000000000n, ... }
Listed invoices (0) => []
```

## Environment variables

Everything has a sensible testnet default, so you can run the example with no
configuration at all. To point at a different deployment, set any of the
following before running:

| Variable                     | Default                                                     | Purpose                                                  |
| ---------------------------- | ----------------------------------------------------------- | -------------------------------------------------------- |
| `HORIZON_URL`                | `https://horizon-testnet.stellar.org`                       | Horizon endpoint                                         |
| `SOROBAN_RPC_URL`            | `https://soroban-testnet.stellar.org`                       | Soroban RPC endpoint                                     |
| `NETWORK_PASSPHRASE`         | `Test SDF Network ; September 2015`                         | Network passphrase                                       |
| `REGISTRY_CONTRACT_ID`       | `CABGWVIZFF62FG67ZGFEP67NEEY4WYTMFURDMFTKKNRDAFPKPOJDTN4C`  | Registry contract                                        |
| `INVOICE_CONTRACT_ID`        | `CA4O3MR7LWHRSUDBNU6FY6UDFFYBN7TGBZXBDZB4OYYXFYXIFJ6RJF6B`  | Invoice contract                                         |
| `POOL_CONTRACT_ID`           | `CAKEWH7SJCXGV2MH2WZYIX3QDPTSSBQFXYVYBOWAGLNBBZMPLE2US6CS`  | Pool contract                                            |
| `ESCROW_CONTRACT_ID`         | `CAJWGUKDTTC3SKN4RAAY72J4DVIIYSCFHX6GIMNTT22ABMISJK4GBCEH`  | Escrow contract                                          |
| `AGENT_REGISTRY_CONTRACT_ID` | _(empty)_                                                   | Agent registry (Until deployed)                          |
| `SIGNER_PUBLIC_KEY`          | a generated testnet keypair public key (see `src/index.ts`) | Public key used for read-call simulations                |
| `FRIENDBOT_URL`              | `https://friendbot.stellar.org`                             | Fundbot endpoint used to fund the default sample account |

Example:

```bash
SIGNER_PUBLIC_KEY=GABCDEFGHIJKLMNOPQRSTUVWXYZ234567 pnpm --filter sdk-quickstart start
```

## Notes

- Read methods require a `signerPublicKey` argument even though they perform no
  writes — Soroban builds and simulates the transaction against an account
  sequence number. Any valid testnet public key works.
- When the built-in sample key is used, the script funds it through Stellar
  testnet Friendbot first, so `pnpm start` works with zero configuration. If
  you pass your own key, make sure it exists on testnet (Friendbot funding is
  skipped only if you rely on the default key; providing your own key assumes
  it is already funded).
- If the sample address is not a registered registry member, `isVerified()`
  returns `false` and `getStats()`/`getByStatus()` still succeed — none of these
  calls throw for unregistered addresses.

## Troubleshooting

- If a Soroban RPC simulation fails with an XDR/`Bad union switch` decode error,
  the installed `@stellar/stellar-sdk` in `packages/sdk` may be older than the
  protocol supported by the RPC endpoint being hit. Bump that dependency first
  and rebuild the SDK (`pnpm --filter @trusttrove/sdk build`) before debugging
  the example itself.
