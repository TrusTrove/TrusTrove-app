# pool_contract

USDC liquidity pool with share-based LP accounting. The share price grows as
invoices repay with yield.

### deposit

```rust
deposit(env: Env, lp: Address, usdc_amount: u128) -> u128
```

Transfers `usdc_amount` USDC from `lp` to the pool and issues shares.
Returns the number of shares issued. `lp.require_auth()` is enforced.

### withdraw

```rust
withdraw(env: Env, lp: Address, shares: u128) -> u128
```

Burns `shares` and transfers the corresponding USDC value back to `lp`.
Returns the USDC amount transferred. Panics if available liquidity is insufficient.

### fund_invoice

```rust
fund_invoice(env: Env, invoice_id: BytesN<32>) -> bool
```

Funds a `Listed` invoice. Calculates `funded_amount`, calls `escrow_contract.lock()`,
calls `escrow_contract.release_to_issuer()`, and calls `invoice_contract.mark_funded()`.
All in one transaction.

### receive_repayment

```rust
receive_repayment(env: Env, invoice_id: BytesN<32>, amount: u128) -> bool
```

Called only by `invoice_contract` during repayment. Records the repayment,
calculates yield, and increases total pool deposits (which raises share price).

### handle_default

```rust
handle_default(env: Env, invoice_id: BytesN<32>) -> bool
```

Called by `invoice_contract` on default. Calls `escrow_contract.handle_default()`
to recover funds. Reduces total deposits by the funded amount.

### get_stats

```rust
get_stats(env: Env) -> PoolStats
```

Returns current pool statistics. Read-only, no auth required.

```rust
PoolStats {
  total_deposits: u128,
  total_funded: u128,
  available_liquidity: u128,
  utilization_rate_bps: u32,
  total_yield_distributed: u128,
  active_invoice_count: u32,
  total_shares: u128,
}
```

### get_lp_position

```rust
get_lp_position(env: Env, lp: Address) -> LPPosition
```

Returns the current position for a given LP address. Returns a zero-value
`LPPosition` if the address has no shares — does not panic.

```rust
LPPosition {
  shares: u128,
  usdc_value: u128,
  yield_earned: u128,
  deposit_count: u32,
}
```
