# Deposit USDC

From the Liquidity Provider Portal
([trustrove.vercel.app/lp](https://trustrove.vercel.app/lp)), connect your
Freighter wallet and find the **Deposit USDC** form.

### Step 1 — Enter deposit amount

- **Deposit amount** — the amount of USDC you want to supply to the pool.

### Step 2 — Review the simulation preview

Once you enter an amount, the form simulates the deposit transaction and shows
a **Transaction Preview** panel below the input:

- **Method** — the contract function that will be called (`deposit`).
- **Footprint Size** — the number of ledger entries the transaction touches.
- **Estimated network fee** — the simulated fee in XLM.

While the simulation runs, the panel shows _Simulating Transaction..._; if the
simulation fails, the panel shows **Simulation Failed** and the error instead —
in that case, do not submit.

The preview does not estimate shares. The number of shares you receive is
determined on-chain at deposit time from the current share price (see
[Understanding Yield](understanding-yield.md) and
[Share mechanics](../protocol/liquidity-pool.md#share-mechanics)).

### Step 3 — Deposit and sign with Freighter

Click **Deposit USDC** (the button reads **Depositing...** while the
transaction is pending). Two transactions may be signed in Freighter, in this
order:

1. **USDC allowance (when needed).** Before your first deposit — or when your
   existing allowance has expired or is too small — the app submits an
   `approve` transaction so the pool contract can pull USDC from your wallet.
   You will see this as a separate Freighter signing prompt. If your allowance
   is already sufficient, this step is skipped and you only sign the deposit.
2. **The `deposit` transaction.** Freighter prompts you to sign the deposit
   itself. Once confirmed, your USDC is transferred to the pool and your
   shares are minted on-chain.

There is no separate **Approve USDC** button in the UI — the allowance check
and approval are handled automatically as part of the deposit.

### Step 4 — Track your position

When the deposit completes you get a **Deposit Complete** toast with the
transaction hash, and the **Pool Overview** and **My Position** sections on the
same page update to show your shares, current USDC value, and yield earned. The
value of your shares increases as funded invoices are repaid with discount
fees.
