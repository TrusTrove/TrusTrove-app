# invoice_contract

Manages the full invoice lifecycle. Enforces state transitions. Emits events
consumed by the Go indexer.

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
