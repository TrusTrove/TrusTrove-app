# invoice_contract

Manages the full invoice lifecycle. Enforces state transitions. Emits events
consumed by the Go indexer.

### initialize

```rust
initialize(env: Env, admin: Address, registry_contract: Address)
```

Sets the admin address and the registry contract address that `create` checks
issuer and buyer enrollment against, and resets the invoice counter. Can only be
called once; a second call panics with `AlreadyInitialized`.

The Underwrite `agent-registry` address that `submit_attestation` calls
cross-contract is **not** a parameter of `initialize`. It is wired afterwards by
the admin-only `set_agent_registry_contract(env, agent_registry_contract: Address)`
and read back with `get_agent_registry_contract()` (see
[submit_attestation](#submit_attestation) below).

The SDK wrapper is
`InvoiceClient.initialize(adminAddress, registryContractAddress, signerPublicKey)` —
`packages/sdk/src/clients/invoice.ts` — which encodes both addresses in contract
order. `packages/sdk/src/clients/invoice.test.ts` keeps this document and the
wrapper's argument counts in sync; the upstream source of truth remains the
`TrusTrove-contract` repo (`contracts/invoice/src/lib.rs`).

### create

```rust
create(
  env: Env,
  issuer: Address,
  buyer: Address,
  face_value: u128,
  due_date: u64
) -> BytesN<32>
```

Creates an invoice on-chain. `face_value` is in USDC stroops (1 USDC = 10,000,000).
`due_date` is a Unix timestamp in seconds. Both `issuer` and `buyer` must be
registered in `registry_contract`. Returns a unique `invoice_id`.

### list_for_financing

```rust
list_for_financing(env: Env, invoice_id: BytesN<32>, discount_bps: u32) -> bool
```

Lists the invoice in the marketplace. `discount_bps` is basis points (200 = 2%).
Max 5000 (50%). Issuer auth required. Invoice must be in `Created` status.

Requires a stored `Attestation` for the invoice (see [submit_attestation](#submit_attestation)
below). The check runs first, right after confirming the invoice exists and before
issuer auth or the discount validation — an unverified invoice fails fast with
`VerificationRequired` rather than falling through to auth/discount checks.

### submit_attestation

```rust
submit_attestation(
  env: Env,
  invoice_id: BytesN<32>,
  payload: Bytes,
  signature: BytesN<65>
) -> ()
```

Records a risk attestation for an invoice, produced off-chain by a registered
Underwrite agent. `payload` encodes `domain_separator`, `invoice_id`, `risk_score`,
`evidence_hash`, `agent_id`, and a `nonce`; `signature` is a recoverable
secp256k1 signature over `keccak256(payload)`.

Permissionless — no `require_auth` on the caller. Trust comes entirely from the
signature: the contract recovers the signer's public key and checks it against
the agent's registered pubkey via a cross-contract call to `agent-registry`
(`AGENT_REGISTRY_CONTRACT`, deployed from the separate `underwrite-contract`
repo — the address this contract calls is read from its own storage, set by the
admin through `set_agent_registry_contract`). The agent must exist, be `active`,
and its stored pubkey must
match the recovered key, or the call panics with `UntrustedSigner`.

One attestation per invoice — a second call for the same `invoice_id` panics
with `AlreadyAttested` (replay guard). On success, stores an `Attestation` and
emits `AttestationSubmitted(invoice_id, agent_id, risk_score)`.

```rust
struct Attestation {
    agent_id: Symbol,
    risk_score: u32,       // basis points, 0-10000
    evidence_hash: BytesN<32>,
    submitted_at: u64,
}
```

New error variants: `UntrustedSigner`, `AlreadyAttested`, `VerificationRequired`.

### mark_funded

```rust
mark_funded(env: Env, invoice_id: BytesN<32>, funded_amount: u128) -> bool
```

Called only by `pool_contract`. Records that the invoice has been funded and
transitions status to `Funded`. The frontend never calls this directly.

### mark_shipped

```rust
mark_shipped(env: Env, invoice_id: BytesN<32>) -> bool
```

Issuer confirms goods or services have been shipped. Status transitions to `Active`.

### confirm_delivery

```rust
confirm_delivery(env: Env, invoice_id: BytesN<32>, confirmer: Address) -> bool
```

Records a delivery confirmation from either the issuer or the buyer. Both must
confirm before status transitions to `Confirmed`. Calling with the same address
twice does not count as two confirmations.

### repay

```rust
repay(env: Env, invoice_id: BytesN<32>) -> bool
```

Buyer transfers `face_value` USDC to the pool. Invoice must be in `Confirmed` status.
Calls `pool_contract.receive_repayment()` after the transfer. Status transitions
to `Repaid`.

### trigger_default

```rust
trigger_default(env: Env, invoice_id: BytesN<32>) -> bool
```

Can be called by admin or `pool_contract` after the due date has passed. Invoice
must be in `Funded`, `Active`, or `Confirmed` status. Calls `pool_contract.handle_default()`.

### get

```rust
get(env: Env, invoice_id: BytesN<32>) -> Invoice
```

Returns the full `Invoice` struct. Read-only.

### get_by_status

```rust
get_by_status(env: Env, status: InvoiceStatus) -> Vec<Invoice>
```

Returns all invoices with the given status. Read-only.

### get_by_issuer

```rust
get_by_issuer(env: Env, address: Address) -> Vec<Invoice>
```

Returns all invoices created by the given issuer address. Read-only.
SDK: `InvoiceClient.getByIssuer(address, signerPublicKey)`.

### get_by_buyer

```rust
get_by_buyer(env: Env, address: Address) -> Vec<Invoice>
```

Returns all invoices naming the given buyer address. Read-only.
SDK: `InvoiceClient.getByBuyer(address, signerPublicKey)` —
`packages/sdk/src/clients/invoice.ts`.
