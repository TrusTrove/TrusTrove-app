# Registry

The registry contract is the access control layer for the entire protocol. No address
can create an invoice, fund an invoice, or repay an invoice unless both the issuer
and the buyer are registered.

### Why registration exists

TrusTrove is a permissioned protocol. Not permissioned by a company — permissioned
by the smart contract. Registration is a lightweight on-chain KYC substitute: both
parties acknowledge they are participating intentionally.

This also creates a verifiable on-chain identity for SMEs over time. After multiple
repaid invoices, an issuer's address builds a transaction history that anyone can
verify on the Stellar ledger.

### What gets stored

```
Profile {
  address: Address
  role: Issuer | Buyer
  verified: bool
  registered_at: u64
  metadata: Map<String, String>
}
```

The metadata field holds optional information — company name, country, contact.
It is stored on-chain and publicly readable. Do not put sensitive information here.

### Revocation

The admin address can revoke any registered profile by setting `verified = false`.
Once revoked, that address cannot participate in any new invoice transactions.
Existing invoices in flight are not affected.
