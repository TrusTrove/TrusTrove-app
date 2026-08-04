# Liquidity Pool

The pool contract holds USDC deposits from liquidity providers and deploys that capital
to fund invoices. LP ownership is represented by shares, not by a fixed USDC balance.

### Share mechanics

When you deposit USDC, you receive shares. The number of shares you receive depends
on the current share price at the time of deposit.

**First deposit (pool is empty):**

```
shares = usdc_amount
```

1 USDC = 1 share. Share price starts at 1.

**Subsequent deposits:**

```
shares = usdc_amount × total_shares / total_usdc_value
```

As invoices repay with yield, `total_usdc_value` grows while `total_shares` stays
the same. This means each share is worth more USDC over time.

### Example

1. LP deposits 1,000 USDC. Pool is empty. They receive 1,000 shares at $1.00 each.
2. Pool funds a $5,000 invoice at 2% discount. Pool pays $4,900. Pool holds $100 in USDC
   and has $4,900 deployed.
3. Invoice repays. Pool receives $5,000. Pool now holds $1,100 USDC.
4. Share price = $1,100 / 1,000 shares = $1.10 per share.
5. LP withdraws. Their 1,000 shares × $1.10 = $1,100. They earned $100 yield.

### Utilization rate

```
utilization_rate = total_funded / total_deposits
```

Expressed in basis points. 7500 = 75% utilization. The pool enforces a maximum
utilization cap (default 85%) — once hit, no new invoices can be funded until
existing ones repay or LPs deposit more.

### Withdrawal

LPs can withdraw at any time, subject to available liquidity. If the pool is 85%
utilized, only 15% of total deposits are available for withdrawal. If you try to
withdraw more than what is available, the transaction fails.

There is no lock-up period. There is no penalty for early withdrawal. But you cannot
withdraw capital that is currently deployed in funded invoices.
