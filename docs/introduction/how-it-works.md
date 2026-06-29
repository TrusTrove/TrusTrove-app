# How It Works

TrusTrove runs on four Soroban smart contracts deployed on Stellar. Here is the complete
flow from invoice creation to repayment.

### Step 1 — Register

Before creating an invoice, both the SME (issuer) and the buyer must be registered in
the registry contract. Registration verifies that both parties have agreed to participate
in the protocol. This is a one-time step.

### Step 2 — Create the invoice

The SME calls `invoice_contract.create()` with four pieces of information:

- Buyer address
- Face value in USDC
- Due date

The contract generates a unique invoice ID and stores the invoice on-chain with status
`Created`. Nothing moves at this point.

### Step 3 — List for financing

The SME calls `list_for_financing()` and sets a discount rate in basis points.
200 basis points = 2%. This is the cost of getting paid early. Status changes to `Listed`.

### Step 4 — Pool funds the invoice

A liquidity provider — or the pool itself on behalf of LPs — calls `fund_invoice()`.
The pool calculates the funded amount:

```
funded_amount = face_value × (1 - discount_bps / 10000)
```

At 2% discount on a $10,000 invoice, the funded amount is $9,800.

The pool sends $9,800 USDC to the escrow contract, which immediately releases it to
the SME. Invoice status changes to `Funded`.

### Step 5 — Ship and confirm

The SME ships the goods and calls `mark_shipped()`. Status changes to `Active`.

Both the SME and the buyer must call `confirm_delivery()`. The contract requires both
confirmations before moving forward — one party cannot claim delivery unilaterally.
Once both confirm, status changes to `Confirmed`.

### Step 6 — Repay

The buyer calls `repay()`, which transfers the full face value ($10,000) from their
wallet to the pool contract. Status changes to `Repaid`.

The pool collects $10,000, having paid out $9,800. The $200 difference distributes
as yield across LP shares, increasing the share price for all LPs proportionally.

### What happens on default

If the due date passes without repayment, anyone can call `trigger_default()`. The
escrow contract returns whatever funds are locked to the pool. The pool takes the loss,
which reduces share value for all LPs.

Default risk is real. LPs accept it when they deposit.
