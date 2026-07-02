# Smart Contracts Overview

TrusTrove runs on four Soroban contracts deployed on Stellar testnet. They call each
other in a defined pattern — the dependency order is fixed and enforced by stored
contract addresses, not off-chain access control.

### Deployed addresses (Stellar testnet)

| Contract          | Address                                                    |
| ----------------- | ---------------------------------------------------------- |
| registry_contract | `CABGWVIZFF62FG67ZGFEP67NEEY4WYTMFURDMFTKKNRDAFPKPOJDTN4C` |
| invoice_contract  | `CA4O3MR7LWHRSUDBNU6FY6UDFFYBN7TGBZXBDZB4OYYXFYXIFJ6RJF6B` |
| escrow_contract   | `CAJWGUKDTTC3SKN4RAAY72J4DVIIYSCFHX6GIMNTT22ABMISJK4GBCEH` |
| pool_contract     | `CAKEWH7SJCXGV2MH2WZYIX3QDPTSSBQFXYVYBOWAGLNBBZMPLE2US6CS` |

### Call graph

```
pool_contract ──── is_verified() ──────► registry_contract
invoice_contract ── is_verified() ──────► registry_contract
pool_contract ──── lock() ──────────────► escrow_contract
pool_contract ──── release_to_issuer() ─► escrow_contract
pool_contract ──── mark_funded() ───────► invoice_contract
invoice_contract ── receive_repayment() ─► pool_contract
```

### Key implementation details

**All amounts in stroops.** 1 USDC = 10,000,000 stroops. The frontend SDK converts
to human-readable values. Contracts never use decimals.

**TTL extension on every write.** Every `persistent().set()` is immediately followed
by `extend_ttl()`. Soroban storage entries expire — skipping TTL extension causes
data loss.

**Auth enforced on-chain.** `pool_contract` is the only address authorized to call
`escrow_contract` write functions and `invoice_contract.mark_funded()`. This is
enforced by comparing `require_auth()` against a stored contract address — not an
API key or off-chain rule.

**Dual delivery confirmation.** Both issuer and buyer must call `confirm_delivery()`
independently. Neither can complete the confirmation alone.
