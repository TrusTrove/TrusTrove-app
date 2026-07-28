# Product

## Register

Registration is the one-time on-chain step that gates all protocol activity. No address can create an invoice, fund a pool, or repay a trade obligation unless both the issuer (SME) and the buyer are registered in the registry contract.

**SME (Issuer) flow:**

1. Install the [Freighter](https://freighter.app) browser extension and switch it to Testnet.
2. Visit the app and click **Connect Wallet** — Freighter handles the SEP-10 authentication challenge automatically.
3. On first connection the app detects an unverified address and surfaces an onboarding prompt. Click **Register as SME**, fill in company details, and sign the `register_issuer` transaction with Freighter. This is a one-time action; the registry contract stores the profile on-chain and emits an `issuer_registered` event.

**Buyer flow:**

The SME shares the app link with their corporate counterparty. The buyer connects their Freighter wallet and completes an equivalent one-time `register_buyer` transaction before any invoice referencing their address can be created.

**Liquidity Provider (LP) flow:**

LPs do not need a separate registration step. Connecting a funded Freighter wallet is sufficient to deposit USDC into the pool and receive LP shares.

**Profile verification:**

The registry contract stores a `Profile` struct with `role` (`Issuer` or `Buyer`), a `verified` flag, `registered_at` timestamp, and arbitrary `metadata`. The admin can revoke verification at any time by setting `verified = false`; revoked addresses cannot participate in new invoice transactions.

## Users

- **SMEs (Lagos textile supplier, Nairobi agri-exporter, Accra electronics distributor)**: Non-crypto-native business owners who need immediate working capital by tokenizing unpaid trade invoices. They require an interface that is extremely fast, highly trustworthy, and clearly displays fees.
- **Liquidity Providers (LPs)**: CFOs, treasurers, and institutional yield-seekers depositing USDC into the pool to earn yield from discount fees. They require data-dense, precise analytics and total transparency on pool utilization.
- **Buyers**: Corporate trade counterparties who confirm receipt of shipments and repay the invoice face value in USDC upon maturity.

## Product Purpose

TrusTrove is a decentralized trade finance protocol on Stellar Soroban that eliminates the $2.5 trillion global trade finance gap by giving SMEs immediate USDC liquidity on unpaid invoices through trustless escrow, share-based liquidity pools, and on-chain invoice tokenization.

## Brand Personality

- **Bloomberg Terminal meets Stellar**: Dark, precise, data-dense, trustworthy enterprise financial operations terminal.
- **Institutional Clarity**: Direct visual feedback, full on-chain status tracking, and strict detail verification.
- **High Utility**: Maximum data density and speed, zero distracting illustrations or playful animations.

## Anti-references

- **Playful DeFi dashboards**: Pastel colors, rounded bubble graphics, cartoonish illustrations.
- **Saturated SaaS templates**: Cream backgrounds, tiny tracked uppercase eyebrows, generic card lists.
- **Low-contrast text**: Hard-to-read gray text.

## Design Principles

1. **Financial Precision**: Monospace fonts for all quantities, addresses, transaction hashes, and IDs.
2. **Operations Terminal Aesthetic**: Deep navy-black theme (#080c10) with sharp colored accent signals representing invoice states.
3. **Data Density**: Multi-column layouts, tables, and gauges showing deep metric lists over spacious margins.
4. **Thumb-Reachable Actions**: SME mobile layout optimization for port/warehouse users to mark shipments and confirm deliveries.

## Accessibility & Inclusion

- Body text meets WCAG AA/AAA standards against `#080c10` void background.
- Direct copy buttons for all cryptographic strings.
- Reduced motion fallback (instant swaps, zero parallax or long drifts).
