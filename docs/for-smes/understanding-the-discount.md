# Understanding the Discount

The discount is the cost of getting paid early. It is set by you and cannot be
changed after listing.

### How it is calculated

```
funded_amount = face_value × (1 - discount_bps / 10000)
your_cost     = face_value × discount_bps / 10000
```

At 200 bps (2%) on a $5,000 invoice:

- You receive: $4,900
- Buyer repays: $5,000
- Your cost: $100

### What rate should you set?

There is no formula. Higher rates attract liquidity faster. Lower rates cost you less.

Check the marketplace to see what rates other invoices are listing at. If similar
invoices are funding at 2%, listing at 1% might mean waiting longer.

### Is this cheaper than alternatives?

At 2% for a 60-day invoice, the annualized cost is roughly 12%.

| Option                  | Approximate annualized cost |
| ----------------------- | --------------------------- |
| TrusTrove (2%, 60 days) | ~12% APR                    |
| Traditional factoring   | 18–30% APR                  |
| Bank credit line        | 15–20% APR                  |
| Credit card             | 24–36% APR                  |

These are rough comparisons. Bank rates vary by country and relationship.
TrusTrove does not guarantee any particular rate.
