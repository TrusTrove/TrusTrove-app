# Understanding Yield

### Where yield comes from

Every invoice funded at a discount generates yield equal to:

```
yield = face_value - funded_amount = face_value × discount_bps / 10000
```

When the buyer repays the full face value, the pool receives more USDC than it paid
out. That surplus increases the total pool value, which raises the share price.

### Your yield is the increase in share price

You do not receive yield as a direct payment. Your yield is realized when you
withdraw — you get back more USDC per share than you paid.

If you deposit when the share price is $1.00 and withdraw when it is $1.10,
you earned 10% on your deposit.

### Risks

**Default risk.** If a buyer does not repay, the pool loses the expected yield
for that invoice. Principal is partially protected (the pool funded at a discount,
so it recovers the funded amount from escrow). But repeated defaults will reduce
the share price over time.

**Liquidity risk.** You can only withdraw what is not currently deployed. If the
pool is 85% utilized, only 15% of deposits are available for immediate withdrawal.

**Smart contract risk.** TrusTrove contracts have not been audited. There may be
bugs. Do not deposit more than you can afford to lose.

**No guaranteed returns.** Yield depends on invoice volume, discount rates, and
repayment behavior. Past performance does not predict future returns.
