# Exit and Liquidity

This guide explains how an LP exits a TrusTrove pool position: what a share is
worth, why available liquidity can limit a withdrawal, how partial withdrawals
work, and what to do when a withdrawal fails. The mechanics are defined in
[Liquidity Pool](../protocol/liquidity-pool.md); this page is the practical
walkthrough.

This page documents the existing `withdraw` contract method, `PoolClient`, pool
endpoints, and LP portal; it does not add a new public command, endpoint, or UI
control.

## The short version

- Your position is measured in **shares**, not USDC.
- A share's USDC value is `total_deposits / total_shares`.
- The pool can only pay out **available liquidity**, which is
  `total_deposits - total_funded`.
- You can withdraw any number of shares up to your balance **and** up to the
  pool's available liquidity. Partial withdrawals are normal.
- There is no lock-up, minimum, or early-exit penalty.
- Withdrawal does not need a USDC allowance. The pool burns your shares and
  sends USDC back.

## Share price

The pool holds USDC deposits and deploys part of them to fund invoices. LP
ownership is represented by shares:

```
share_price       = total_deposits / total_shares
withdrawal_value  = shares_to_burn × share_price
```

`total_deposits` is the pool's accounting value, not just its idle cash. When an
invoice is funded, USDC moves from idle cash into a funded receivable, but
`total_deposits` does not change. When the buyer repays, the pool receives the
face value; the extra amount over the funded amount is yield, which raises
`total_deposits` and therefore the share price.

On the first deposit into an empty pool, shares are minted 1:1 and the share
price starts at 1.0000. Later deposits mint:

```
new_shares = usdc_deposited × total_shares / total_deposits
```

The **Liquidity Provider Portal** does not display a "share price" label
directly. You can read it from **My Position**: divide **Current USDC Value** by
**Redeemable Shares**.

## Utilization and available liquidity

```
available_liquidity = total_deposits - total_funded
utilization_rate    = total_funded / total_deposits
```

Utilization is shown as a percentage in **Pool Overview**. The pool enforces a
maximum utilization cap of 85% by default. Once funding would push utilization
above the cap, new invoices cannot be funded until existing invoices repay or
LPs deposit more.

The cap also limits exits. At 85% utilization, only 15% of `total_deposits` is
idle and immediately withdrawable. The rest is deployed in funded invoices and
cannot be pulled out until those invoices repay or default.

The maximum number of shares you can redeem right now is the smaller of:

```
your shares
available_liquidity × total_shares / total_deposits
```

If the second limit is smaller, redeem fewer shares now and withdraw the rest
after invoices repay.

## Expected path: withdraw from the portal

1. Open [trustrove.vercel.app/lp](https://trustrove.vercel.app/lp) and connect
   Freighter on **Stellar Testnet** with **Connect Wallet**.
2. In **Pool Overview**, check **Available Liquidity** and **Utilization**.
   In **My Position**, check **Redeemable Shares** and **Current USDC Value**.
3. In the **Withdraw Liquidity** form, enter the number of **Shares to redeem**.
   The helper below the input shows `Available: <your shares>`.
4. Click **Withdraw Shares**. Review the dialog titled
   **Confirm Withdraw LP liquidity** and click **CONFIRM**.
5. Sign the `withdraw(lp, shares)` transaction in Freighter. The button reads
   **Withdrawing...** while the transaction is pending.
6. On success, the app shows a **Withdrawal Complete** toast with a
   **View on Stellar Expert →** link, and **Pool Overview** and **My Position**
   refresh.

On-chain, `pool_contract.withdraw(lp, shares)`:

- requires authorization from `lp`;
- burns the requested shares;
- computes the USDC value from the current share price;
- transfers that USDC from the pool to `lp`;
- reduces `total_deposits` and `total_shares` proportionally.

Because both totals fall by the same proportion, the share price for the
remaining LPs is unchanged, apart from integer rounding. Your remaining shares
keep earning yield on the same terms.

## Worked example

A pool has 100,000.00 USDC of deposits, 100,000.00 shares, and 75,000.00 USDC
deployed in invoices:

| Metric              | Value           |
| ------------------- | --------------- |
| Total deposits      | 100,000.00 USDC |
| Total shares        | 100,000.00      |
| Share price         | 1.0000 USDC     |
| Total funded        | 75,000.00 USDC  |
| Available liquidity | 25,000.00 USDC  |
| Utilization         | 75.00%          |

You own 10,000.00 shares, so **My Position** shows 10,000.00 USDC and 0.00
accrued yield.

### 1 — A new invoice is funded

The pool funds a 10,000.00 USDC face-value invoice at 200 bps (2%). It pays the
issuer 9,800.00 USDC, so 9,800.00 USDC moves from idle cash into the funded
receivable.

| Metric              | After funding   |
| ------------------- | --------------- |
| Total deposits      | 100,000.00 USDC |
| Total shares        | 100,000.00      |
| Share price         | 1.0000 USDC     |
| Total funded        | 84,800.00 USDC  |
| Available liquidity | 15,200.00 USDC  |
| Utilization         | 84.80%          |

Your 10,000.00 shares are still worth 10,000.00 USDC. Funding does not create
yield yet; it converts cash into a receivable at cost.

Utilization is now 84.80%, just under the 85% cap. Another 1,000.00 USDC
face-value invoice at the same discount would require 980.00 USDC of funding,
pushing utilization to 85.78% (85,780.00 / 100,000.00). The pool would reject
that funding until liquidity improves.

### 2 — The buyer repays

The buyer repays the full 10,000.00 USDC face value. The pool receives 10,000.00
USDC, removes the 9,800.00 USDC funded amount from `total_funded`, and keeps the
200.00 USDC discount as yield.

| Metric              | After repayment |
| ------------------- | --------------- |
| Total deposits      | 100,200.00 USDC |
| Total shares        | 100,000.00      |
| Share price         | 1.0020 USDC     |
| Total funded        | 75,000.00 USDC  |
| Available liquidity | 25,200.00 USDC  |
| Utilization         | 74.85%          |

Your 10,000.00 shares are now worth 10,020.00 USDC. Your accrued yield is
20.00 USDC: 10% of the pool's 200.00 USDC yield because you own 10% of the
shares.

### 3 — You make a partial withdrawal

You redeem 5,000.00 of your 10,000.00 shares:

```
5,000.00 shares × 1.0020 USDC = 5,010.00 USDC
```

After the withdrawal:

| Metric                    | Value          |
| ------------------------- | -------------- |
| Your remaining shares     | 5,000.00       |
| Your remaining USDC value | 5,010.00 USDC  |
| Pool total deposits       | 95,190.00 USDC |
| Pool total shares         | 95,000.00      |
| Share price               | 1.0020 USDC    |
| Pool available liquidity  | 20,190.00 USDC |

The share price did not change for the remaining LPs. Your remaining 5,000.00
shares still represent 5,010.00 USDC and continue to earn yield.

## Boundary cases and failure recovery

### Empty or zero position

- With 0 shares, **My Position** shows 0.00 USDC, the **Withdraw Shares** button
  is disabled, and the helper reads `Available: 0.00 USDC`.
- Entering an amount greater than zero with no shares produces
  **Amount exceeds your redeemable shares.** Nothing is submitted.
- A brand-new pool with no shares has no meaningful share price. The first
  deposit mints shares 1:1 at 1.0000 USDC.

### Invalid input

| Input                                                    | What happens                                                                                                                                     |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Empty, zero, negative, or non-numeric                    | **Enter an amount greater than zero.** No transaction.                                                                                           |
| More shares than you own                                 | **Amount exceeds your redeemable shares.** No transaction.                                                                                       |
| Shares within your balance but above available liquidity | The app allows the form, but the on-chain simulation fails. A **Withdrawal Failed** toast appears with the contract error. No shares are burned. |
| Pool fully utilized (`available_liquidity = 0`)          | Any withdrawal fails on-chain. Wait for repayments or new deposits.                                                                              |

The UI checks your share balance before opening the confirmation dialog, but it
cannot check `available_liquidity` against the live contract at that moment. The
contract is the final authority.

### Wallet, network, and permission

- **Wallet not connected:** the portal shows **Connect Your Wallet** instead of
  the forms.
- **Wrong network:** use **Switch to Testnet** or switch inside Freighter, then
  reconnect.
- **Permission:** only the address that owns the shares can withdraw them. The
  form always uses the connected wallet; there is no delegate or third-party
  withdrawal. No USDC allowance is required for a withdrawal.
- **Transaction timeout:** the portal shows a **Withdrawal Failed** toast (the
  SDK surfaces a timeout error). Check **My Position** and the pool before
  retrying. If your shares are already reduced, the withdrawal succeeded; do not
  submit it again.
- **Signature rejected in Freighter:** the app reports **Withdrawal Failed**
  and no shares are burned. Retry when ready.

## Verify with the API or SDK

Read the pool and your position:

```bash
curl -s "$API_BASE_URL/pool/stats" | jq
curl -s "$API_BASE_URL/pool/position/$LP_ADDRESS" | jq
```

The pool statistics response carries the same numbers as **Pool Overview**.
Using the state after the repayment above:

| Field                     | Example           | Meaning                                 |
| ------------------------- | ----------------- | --------------------------------------- |
| `total_deposits`          | `"1002000000000"` | 100,200.00 USDC of LP capital and yield |
| `total_funded`            | `"750000000000"`  | 75,000.00 USDC deployed in invoices     |
| `available_liquidity`     | `"252000000000"`  | 25,200.00 USDC immediately withdrawable |
| `utilization_rate_bps`    | `7485`            | 74.85% utilized                         |
| `total_shares`            | `"1000000000000"` | 100,000.00 shares                       |
| `total_yield_distributed` | `"2000000000"`    | 200.00 USDC of yield distributed        |

`active_invoice_count` and `updated_at` are operational fields; the example
does not pin them because the 75,000.00 already deployed can span several older
invoices.

The position response is in stroops (1 USDC = 10,000,000 stroops):

```json
{
  "shares": "100000000000",
  "usdc_value": "100200000000",
  "yield_earned": "200000000",
  "deposit_count": 1
}
```

That is 10,000.00 shares worth 10,020.00 USDC with 20.00 USDC of yield.

Direct SDK callers can read the same values and withdraw by share count:

```ts
import { PoolClient } from "@trusttrove/sdk";

const pool = new PoolClient(poolContractId);
const stats = await pool.getStats(address);
const position = await pool.getLPPosition(address, address);

console.log(
  stats.availableLiquidity,
  stats.totalShares,
  stats.utilizationRateBps,
);
console.log(position.shares, position.usdcValue, position.yieldEarned);

await pool.withdraw(address, sharesToRedeem, address);
```

The `sharesToRedeem` argument is a `bigint` in share units, not USDC. The SDK
returns the transaction hash as a string. Contract errors surface as
`SimulationError`, `TransactionFailedError`, or `TransactionTimeoutError`; see
the [SDK Reference](../developer-guide/sdk-reference.md#error-handling).

## Related reading

- [Liquidity Pool](../protocol/liquidity-pool.md) — share math and contract semantics
- [Understanding Yield](understanding-yield.md) — where yield comes from and the risks
- [Deposit USDC](deposit-usdc.md) — the entry side of the position
- [Pool contract](../smart-contracts/pool-contract.md) — `withdraw` and utilization cap
- [Economic Model](../protocol/economic-model.md) — yield and default examples
