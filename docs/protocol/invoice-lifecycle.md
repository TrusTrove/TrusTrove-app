# Invoice Lifecycle

Every invoice in TrusTrove moves through a defined set of states. The smart contract
enforces these transitions — no state can be skipped, and no transition can happen
out of order.

```
Created → Listed → Funded → Active → Confirmed → Repaid
                                    ↘ Defaulted
```

### Created

Triggered by: `invoice_contract.create(issuer, buyer, face_value, due_date)`  
Who calls it: SME (issuer)  
Money movement: none

The invoice exists on-chain. Both issuer and buyer addresses are recorded. Face value
and due date are locked — they cannot be changed after creation. The invoice is not
yet visible in the marketplace.

### Listed

Triggered by: `invoice_contract.list_for_financing(invoice_id, discount_bps)`  
Who calls it: SME (issuer)  
Money movement: none

The SME sets a discount rate and makes the invoice visible in the marketplace. Liquidity
providers can see and fund it. The discount rate is final — it cannot be changed after
listing.

### Funded

Triggered by: `pool_contract.fund_invoice(invoice_id)`  
Who calls it: LP or anyone interacting with the pool  
Money movement: pool → escrow (funded amount locked), escrow → issuer (funded amount released)

The pool calculates the funded amount, locks it in escrow, and immediately releases
it to the SME. The full face value is now owed by the buyer at the due date. The
invoice is no longer available in the marketplace.

### Active

Triggered by: `invoice_contract.mark_shipped(invoice_id)`  
Who calls it: SME (issuer)  
Money movement: none

The SME confirms the goods or services have been shipped or delivered on their end.
This opens the confirmation window for both parties.

### Confirmed

Triggered by: both `confirm_delivery()` calls completing  
Who calls it: SME first, then buyer (or buyer first, then SME — order does not matter)  
Money movement: none

Both parties have confirmed delivery. The invoice is now eligible for repayment.
The smart contract tracks each confirmation separately — `issuer_confirmed` and
`buyer_confirmed` are two independent boolean flags. Status only changes to `Confirmed`
when both are `true`.

### Repaid

Triggered by: `invoice_contract.repay(invoice_id)`  
Who calls it: Buyer  
Money movement: buyer → pool (face value), yield distributes to LP shares

The buyer sends the full face value to the pool. The pool records the repayment,
calculates yield (face_value − funded_amount), and distributes it by increasing
the share price. All LPs benefit proportionally.

### Defaulted

Triggered by: `invoice_contract.trigger_default(invoice_id)`  
Who calls it: Admin or pool_contract  
Condition: current timestamp > due_date AND status is Funded, Active, or Confirmed  
Money movement: escrow returns locked funds to pool, pool takes the loss

The invoice did not repay by the due date. The pool recovers whatever is in escrow
(which is the funded amount, not the face value). The difference between face value
and funded amount is a permanent loss to the pool, shared across all LP shares.
