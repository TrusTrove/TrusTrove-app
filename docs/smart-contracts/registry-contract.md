# registry_contract

Tracks verified issuers and buyers. Every other contract calls `is_verified()`
before allowing any action.

### initialize

```rust
initialize(env: Env, admin: Address)
```

Sets the admin address. Can only be called once. Panics if called again.

### register_issuer

```rust
register_issuer(env: Env, address: Address, metadata: Map<String, String>) -> bool
```

Registers an SME as a verified invoice issuer.

- `address.require_auth()` — the address must sign this transaction
- Panics with `AlreadyRegistered` if the address is already registered
- Stores a `Profile` with `role: Issuer, verified: true`
- Emits `issuer_registered` event
- Returns `true`

### register_buyer

```rust
register_buyer(env: Env, address: Address, metadata: Map<String, String>) -> bool
```

Same as `register_issuer` but sets `role: Buyer`.

### is_verified

```rust
is_verified(env: Env, address: Address) -> bool
```

Read-only. Returns `true` if the address is registered and `verified = true`.
Returns `false` if the address is not registered — does not panic.

### get_profile

```rust
get_profile(env: Env, address: Address) -> Profile
```

Returns the full `Profile` struct for a registered address. Panics with `NotFound`
if the address is not registered.

### revoke

```rust
revoke(env: Env, address: Address) -> bool
```

Sets `verified = false` on the profile. Admin only. The address can no longer
participate in new invoice transactions.
