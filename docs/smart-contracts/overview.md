# Smart Contracts Overview

TrusTrove's core protocol runs on four Soroban contracts deployed on Stellar testnet,
plus Underwrite's external `agent-registry` contract, which `invoice_contract` calls
to verify risk attestations. The core contracts call each other in a defined pattern —
the dependency order is fixed and enforced by stored contract addresses, not off-chain
access control.

### Deployed addresses (Stellar testnet)

| Contract          | Address                                                    |
| ----------------- | ---------------------------------------------------------- |
| registry_contract | `CABGWVIZFF62FG67ZGFEP67NEEY4WYTMFURDMFTKKNRDAFPKPOJDTN4C` |
| invoice_contract  | `CA4O3MR7LWHRSUDBNU6FY6UDFFYBN7TGBZXBDZB4OYYXFYXIFJ6RJF6B` |
| escrow_contract   | `CAJWGUKDTTC3SKN4RAAY72J4DVIIYSCFHX6GIMNTT22ABMISJK4GBCEH` |
| pool_contract     | `CAKEWH7SJCXGV2MH2WZYIX3QDPTSSBQFXYVYBOWAGLNBBZMPLE2US6CS` |
| agent-registry (external) | Set via `AGENT_REGISTRY_CONTRACT` — deployed from the separate `underwrite-contract` repo, not from this monorepo |

### Call graph

```
pool_contract    ── is_verified() ─────────────► registry_contract
invoice_contract ── is_verified() ─────────────► registry_contract
invoice_contract ── get_agent() ───────────────► agent-registry (external)
pool_contract    ── lock() ────────────────────► escrow_contract
pool_contract    ── release_to_issuer() ───────► escrow_contract
pool_contract    ── release_to_pool() ─────────► escrow_contract (repayment)
pool_contract    ── handle_default() ──────────► escrow_contract (default)
pool_contract    ── mark_funded() ─────────────► invoice_contract
invoice_contract ── receive_repayment() ───────► pool_contract
invoice_contract ── handle_default() ──────────► pool_contract (trigger_default)
```

Every documented cross-contract call is represented above. The end-to-end flows:

**Funding:** `invoice_contract` is `Listed` → `pool_contract.fund_invoice()` calls
`escrow_contract.lock()` then `escrow_contract.release_to_issuer()`, then
`invoice_contract.mark_funded()`.

**Repayment:** the buyer calls `invoice_contract.repay()` → `escrow_contract.release_to_pool()`
returns the locked funds to `pool_contract.receive_repayment()`, which records the
repayment and raises the share price. See
[invoice-lifecycle.md](../protocol/invoice-lifecycle.md#repaid).

**Default:** `invoice_contract.trigger_default()` calls `pool_contract.handle_default()`,
which calls `escrow_contract.handle_default()`. For a funded invoice escrow already
released its funds, so `handle_default()` returns `false` and the pool absorbs the
funded amount as a principal loss. See
[invoice-lifecycle.md](../protocol/invoice-lifecycle.md#defaulted).

### The Underwrite agent-registry dependency

`invoice_contract` depends on Underwrite's external `agent-registry` contract. Its
`submit_attestation` recovers the signer's public key and calls
`agent-registry.get_agent()` to check the agent exists, is active, and its stored
pubkey matches. The address is read from `invoice_contract`'s own storage, set once at
`initialize`, and configured via `AGENT_REGISTRY_CONTRACT` (backend) /
`NEXT_PUBLIC_AGENT_REGISTRY_CONTRACT_ID` (frontend). It is not deployed from this
monorepo and has no fixed testnet address here — the repo is maintained by the
Underwrite team as `underwrite-contract`. See
[environment-variables.md](../developer-guide/environment-variables.md) and
[invoice-contract.md](invoice-contract.md#submit_attestation).

### Key implementation details

**All amounts in stroops.** 1 USDC = 10,000,000 stroops. The frontend SDK converts
to human-readable values. Contracts never use decimals.

**TTL extension on every write.** Every `persistent().set()` is immediately followed
by `extend_ttl()`. Soroban storage entries expire — skipping TTL extension causes
data loss.

**Auth enforced on-chain.** `pool_contract` is the only address authorized to call
`escrow_contract` write functions and `invoice_contract.mark_funded()`. This is
enforced by comparing `require_auth()` against a stored contract address — not an
API key or off-chain rule. (`invoice_contract.trigger_default()` may be called by
the admin or `pool_contract`.)

**Dual delivery confirmation.** Both issuer and buyer must call `confirm_delivery()`
independently. Neither can complete the confirmation alone.
