# Getting Started as a Liquidity Provider

To provide liquidity on TrusTrove you need:

1. **Freighter wallet** — install at [freighter.app](https://freighter.app)
2. **Testnet USDC** — get some at [demo.stellar.org](https://demo.stellar.org)
3. **Understanding of the risks** — read [Understanding Yield](understanding-yield.md)
   before depositing

### Connect and deposit

Open the **Liquidity Provider Portal** at
[trustrove.vercel.app/lp](https://trustrove.vercel.app/lp) and connect Freighter
on testnet. You'll see the **Pool Overview** and **My Position** sections, plus
the **Deposit USDC** and **Withdraw Liquidity** forms.

Enter the amount in the **Deposit USDC** form and review the transaction
preview. Click **Deposit USDC** and sign with Freighter (the app handles the
USDC allowance automatically — see
[Deposit USDC](deposit-usdc.md#step-3--deposit-and-sign-with-freighter)).

Your USDC is now in the pool and will be deployed to fund invoices automatically
when LPs or pool managers call `fund_invoice()`.

### Withdraw

To redeem your liquidity, use the **Withdraw Liquidity** form on the same page:
enter the number of shares to redeem and click **Withdraw Shares**, then confirm
in the dialog and sign with Freighter. Withdrawal is subject to available
liquidity — see [Withdrawal](../protocol/liquidity-pool.md#withdrawal) for how
utilization limits what you can pull out, and
[Understanding Yield](understanding-yield.md) for when yield is realized.
