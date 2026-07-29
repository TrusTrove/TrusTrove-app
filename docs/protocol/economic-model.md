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

When a buyer defaults, the pool loses the yield and a portion of principal.
Specifically, the pool funded at a discount, so it already holds less than face value.
On default, it recovers only the funded amount from escrow — which is exactly what
it paid. Net loss to the pool on default: zero principal loss, full yield loss.

Wait — that is not quite right for the other LPs. If the pool funded $9,800 and
collects $9,800, that LP's capital is returned. But the expected yield ($200) is
gone. Since yield was already priced into the share price expectations, LPs see
a reduction in expected returns, not necessarily principal.

LPs should understand this before depositing.
