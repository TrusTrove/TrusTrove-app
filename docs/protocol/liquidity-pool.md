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

1. LP deposits 5,000 USDC. Pool is empty. They receive 5,000 shares at $1.00 each.
2. Pool funds a $5,000 invoice at 2% discount. Pool pays $4,900. Pool holds $100 in USDC
   and has $4,900 deployed.
3. Invoice repays. Pool receives $5,000. Pool now holds $5,100 USDC ($100 idle + $5,000
   received) with nothing deployed.
4. Share price = $5,100 / 5,000 shares = $1.02 per share.
5. LP withdraws. Their 5,000 shares × $1.02 = $5,100. They earned $100 yield (the 2%
   discount on the $5,000 invoice).

### Utilization rate

```
utilization_rate = total_funded / total_deposits
```

Expressed in basis points. 7500 = 75% utilization. The pool enforces a maximum
utilization cap (default 85%, i.e. 8500 bps) — once hit, no new invoices can be
funded until existing ones repay or LPs deposit more. The cap is stored per pool
at initialization and can be changed by the admin; see
[pool-contract.md](../smart-contracts/pool-contract.md#utilization-cap).

### Withdrawal

LPs can withdraw at any time, subject to available liquidity. If the pool is at
its 85% utilization cap, only 15% of total deposits are available for withdrawal.
If you try to withdraw more than what is available, the transaction fails.

There is no lock-up period. There is no penalty for early withdrawal. But you cannot
withdraw capital that is currently deployed in funded invoices.
