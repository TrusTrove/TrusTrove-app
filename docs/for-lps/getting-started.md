# Getting Started as a Liquidity Provider

To provide liquidity on TrusTrove you need:

1. **Freighter wallet** — install at [freighter.app](https://freighter.app)
2. **Testnet USDC** — get some at [demo.stellar.org](https://demo.stellar.org)
3. **Understanding of the risks** — read [Understanding Yield](understanding-yield.md)
   before depositing

### Connect and deposit

Go to [trustrove.vercel.app/lp](https://trustrove.vercel.app/lp) and connect Freighter
on testnet. Go to the **LP Portal** and click **Deposit USDC**.

Enter the amount you want to deposit. The form shows how many shares you will receive
and the current share price. Click **Deposit** and sign with Freighter.

Your USDC is now in the pool and will be deployed to fund invoices automatically
when LPs or pool managers call `fund_invoice()`.
