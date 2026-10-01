# Economic Model

### For SMEs

The cost of financing is the discount. Nothing else.

```
cost = face_value × discount_bps / 10000
funded_amount = face_value - cost
```

At 200 bps (2%) on a $10,000 invoice with 60-day terms:

- You receive today: $9,800
- Buyer repays at day 60: $10,000
- Your cost: $200

Annualized cost (approximate):

```
APR ≈ (discount / funded_amount) × (365 / days_to_due_date)
    = (200 / 9800) × (365 / 60)
    ≈ 12.4%
```

Compare: bank credit lines typically run 15–20% APR. Traditional factoring runs
18–30% annualized when fees are included. TrusTrove at 2% for 60 days costs 12.4%.

The SME sets the discount. Lower discount = cheaper but may take longer to attract
a funder. Higher discount = more expensive but funds faster. The market determines
what rates clear.

### For LPs

Yield comes entirely from invoice discounts. The pool collects the spread between
what it pays (funded_amount) and what it receives (face_value).

```
yield per invoice = face_value - funded_amount = face_value × discount_bps / 10000
```

Annualized yield depends on:

1. The weighted average discount rate across funded invoices
2. Pool utilization rate — idle capital earns nothing
3. Default rate — defaults reduce pool value

At 75% utilization, 2% average discount, 60-day average term, zero defaults:

```
approximate APY ≈ utilization × discount × (365 / avg_days)
               ≈ 0.75 × 0.02 × (365 / 60)
               ≈ 9.1%
```

This is not a guarantee. It is illustrative. Actual yield depends on which invoices
fund, whether they repay, and how long capital sits idle between deployments.

### Default risk

When a buyer defaults, the pool loses the **full funded amount** — principal,
not just yield. This follows from how funding and default work on-chain:
`pool_contract.fund_invoice` locks the funded amount in escrow and immediately
releases it to the SME in the same transaction, so escrow holds nothing for a
funded invoice. On default, `escrow_contract.handle_default()` therefore finds
no record and recovers nothing, and `pool_contract.handle_default()` reduces
total deposits by the funded amount. The loss is shared across all LP shares
through a lower share price.

Worked example (2% discount, $10,000 face value):

- Pool holds $100,000 in deposits → 100,000 shares at $1.00.
- Pool funds the invoice: $9,800 leaves the pool, SME receives $9,800.
- Buyer defaults. Escrow holds $0 for this invoice, so the pool recovers $0.
- Total deposits drop by the $9,800 funded amount: $100,000 → $90,200 against
  the same 100,000 shares. Share price falls $1.00 → $0.902.
- An LP who deposited $1,000 (1,000 shares) can now withdraw ~$902 — a $98
  principal loss from this single default, plus the $200 of yield that never
  materialized.

LPs should understand this before depositing: a default destroys the capital
the pool advanced, up to the full funded amount per defaulted invoice.
