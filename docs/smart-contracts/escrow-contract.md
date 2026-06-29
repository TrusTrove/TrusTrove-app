# escrow_contract

Holds USDC between the moment the pool funds an invoice and the moment the issuer
receives the funds. Only `pool_contract` can call write functions on this contract.
The frontend never calls escrow directly.

### lock

```rust
lock(env: Env, invoice_id: BytesN<32>, amount: u128) -> bool
```

Transfers `amount` USDC from `pool_contract` to the escrow contract and creates
an `EscrowRecord`. `pool_contract.require_auth()` is enforced.

### release_to_issuer

```rust
release_to_issuer(env: Env, invoice_id: BytesN<32>) -> bool
```

Transfers the locked amount to the invoice issuer. Deletes the `EscrowRecord`.
Called immediately after `lock` in the `fund_invoice` flow.

### release_to_pool

```rust
release_to_pool(env: Env, invoice_id: BytesN<32>, repayment_amount: u128) -> bool
```

Transfers funds back to `pool_contract`. Called during repayment flow.

### handle_default

```rust
handle_default(env: Env, invoice_id: BytesN<32>) -> bool
```

Returns locked funds to `pool_contract`. Called when an invoice defaults.
Returns `false` (no panic) if no record exists for the invoice.

### get_locked

```rust
get_locked(env: Env, invoice_id: BytesN<32>) -> u128
```

Returns the amount currently locked for a given invoice. Returns 0 if no record
exists. Read-only, no auth required.
