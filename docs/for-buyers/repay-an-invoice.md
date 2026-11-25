# Repay an Invoice

This walkthrough is for the **buyer** named on a TrusTrove invoice. It covers
the wallet, asset, balance, allowance, signing, receipt, and failure-recovery
steps for a normal repayment. It assumes the invoice has already been funded
and delivery has been confirmed.

This page documents the existing repayment flow; it does not add a new public
command, endpoint, or UI control.

> **Key point:** the buyer repays the **full face value**, not the discounted
> amount the issuer received. The discount is the issuer's financing cost.

## What you need

| Requirement    | Details                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------- |
| Wallet         | Freighter on **Stellar Testnet**, connected with **Connect Wallet**                         |
| Identity       | Your wallet must be the invoice's buyer (registered in TrusTrove), and the app role must be **Buyer** |
| Asset          | USDC for the current invoice repayment flow. Always repay in the asset shown on the invoice |
| Balance        | At least the invoice face value, plus a small XLM balance for network fees                  |
| Invoice status | `Confirmed`. If the invoice is `Funded` or `Active`, an earlier step is still pending       |

Amounts are stored in **stroops**: 1 USDC = 10,000,000 stroops. A $10,000.00
invoice has `face_value: "100000000000"` in the API and in the contract call.

## Expected path

### 1 — Open the invoice and connect the buyer wallet

Open the invoice link, for example:

```
https://trustrove.vercel.app/invoice/<invoice_id>
```

Click **Connect Wallet** and approve the connection in Freighter. The app
expects Testnet. If Freighter is on another network, you will see:

> Your Freighter wallet is connected to the wrong network. Please switch
> Freighter to Stellar Testnet and try again.

Use **Switch to Testnet** or switch inside Freighter, then reconnect. The
invoice page only shows the confirm and repay controls when the app role is
**Buyer** (choose it in the navbar role selector) and the invoice is in the
right status.

### 2 — Confirm delivery, if you have not already

When the invoice is `Active`, the buyer sees **CONFIRM DELIVERY**.

1. Click **CONFIRM DELIVERY**.
2. Review the confirmation dialog.
3. Click **CONFIRM** and sign in Freighter.

The issuer's side is recorded when the issuer clicks **MARK GOODS SHIPPED**.
Once both confirmations are recorded, the invoice status becomes `Confirmed`.
If **REPAY INVOICE** is not visible, check that the invoice is `Confirmed`, that
the app role is **Buyer**, and that the connected wallet is the buyer.

### 3 — Check the amount and your balance

The amount you owe is the invoice **face value**, not `funded_amount`. For
example:

| Field                          | Value                                   |
| ------------------------------ | --------------------------------------- |
| Face value                     | 10,000.00 USDC = `100000000000` stroops |
| Discount                       | 200 bps (2.00%)                         |
| Funded amount (paid to issuer) | 9,800.00 USDC = `98000000000` stroops   |
| Buyer repayment                | **10,000.00 USDC**                      |

Before signing, confirm that your wallet holds at least the face value in USDC
and enough XLM for the network fee. The app does not partially repay an
invoice: the contract requires the full face value.

### 4 — Understand the USDC allowance

Repayment uses `transfer_from`, so the invoice contract needs a USDC allowance
from your wallet. The app handles this automatically through
`ensureAllowance(invoiceContractID, invoice.faceValue)`:

1. The app reads your current allowance to the **invoice contract**.
2. If the allowance is already at least the face value, no approval is needed.
3. Otherwise Freighter prompts you to sign an `approve` transaction. The
   approval expires after roughly 31 days (`latest ledger + 535,680` ledgers).
4. After the approval confirms, Freighter prompts you to sign the repayment.

There is **no separate "Approve USDC" button** in the UI. If the approval is
sufficient, you only see the repayment prompt. If you reject the approval, the
app reports **Allowance rejected** and no repayment is submitted. If the
approval succeeds but the repayment fails later, the allowance remains and you
can retry the repayment without approving again.

### 5 — Sign the repayment

1. Click **REPAY INVOICE**.
2. Review the dialog titled **Confirm Repay Invoice**. It shows the action, the
   truncated invoice ID, and the network-fee note.
3. Click **CONFIRM**.
4. The **Transaction Pending** dialog appears with **Repaying invoice...**.
5. Sign the `repay(invoice_id)` transaction in Freighter.

On-chain, `invoice_contract.repay(invoice_id)`:

- transfers the full face value in USDC from the buyer to the pool contract;
- calls `pool_contract.receive_repayment(invoice_id, amount)`;
- records the repayment and distributes the discount as LP yield;
- changes the invoice status to `Repaid`.

### 6 — Keep the receipt

After the transaction confirms:

- The app shows the **Invoice Repaid** toast.
- The **Transaction Pending** dialog shows the transaction hash and a
  **VIEW ON STELLAR EXPERT** link. The dialog can be closed after the hash is
  available, or after the timeout message appears.
- The invoice status becomes **Repaid**.
- The status timeline marks **Repaid** and shows `repaid_at`.
- **Download PDF** exports the invoice record with the invoice ID, status,
  face value, discount rate, funded amount, parties, due date, and timeline.
- `GET /invoices/:id` returns `status: "Repaid"`, a non-null `repaid_at`, and
  `buyer_confirmed: true`.

The PDF is the current receipt artifact. There is no separate payment-receipt
page.

## What the money does

Using the $10,000 invoice above:

| Party      | Before repayment                     | At repayment       | After repayment           |
| ---------- | ------------------------------------ | ------------------ | ------------------------- |
| Buyer cash | —                                    | −10,000.00 USDC    | Invoice settled           |
| Pool       | Holds 9,800.00 deployed              | +10,000.00 USDC    | +200.00 USDC yield        |
| Issuer     | Already received 9,800.00 at funding | No further payment | Financing cost was 200.00 |

The buyer does not pay the 200.00 discount separately. It is already embedded
in the difference between the funded amount and the face value. See
[Reconcile an Invoice](../for-smes/reconcile-invoice.md) for the issuer-side
accounting entries.

## Boundary cases and failure recovery

### Empty balance or empty allowance

- **Zero USDC balance:** the repayment simulation fails and the app reports
  **Repayment Failed**. No funds move. Add USDC to the buyer wallet and retry.
- **Zero or expired allowance:** the app prompts for an `approve` transaction
  before the repayment. If approval is rejected, the app reports
  **Allowance rejected**; retry and approve when ready.

### Invalid state, role, or network

| Symptom                             | Cause                                                                   | Recovery                                                               |
| ----------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **REPAY INVOICE** is not shown      | Invoice is not `Confirmed`, the app role is not **Buyer**, or the connected wallet is not the buyer | Complete **CONFIRM DELIVERY**, set the role to **Buyer**, and reconnect the buyer wallet |
| Wrong-network message               | Freighter is not on Testnet                                             | Use **Switch to Testnet** or switch in Freighter, then reconnect       |
| **Ledger entry not found**          | The invoice ID is wrong or not indexed                                  | Recheck the link and invoice ID; return to **Dashboard**               |
| Repayment fails immediately         | Wrong status, wrong signer, unregistered buyer, or insufficient balance | Check status, wallet, registration, and USDC balance; no state changed |
| Contract rejects a second repayment | Invoice is already `Repaid`                                             | Nothing to do; the first repayment already settled the invoice         |

### Signing and transaction failures

- **Signature rejected in Freighter:** the app reports **Repayment Failed** and
  nothing is submitted. Retry when ready.
- **Transaction timeout:** the dialog shows **Confirmation timed out. You can
  close and check status manually.** Check the invoice status and the Stellar
  Expert link before retrying. If the invoice is already `Repaid`, do not retry.
  If it is still `Confirmed`, retry the repayment.
- **Approval succeeded, repayment failed:** the allowance remains on-chain.
  Retry the repayment; you normally will not be asked to approve again.
- **Network congestion:** the SDK may surface a congestion/timeout error. Use
  the transaction hash when available; resubmitting is only safe when the
  previous transaction was not confirmed.

### Permission boundary

Only the invoice's buyer can repay it. The issuer, an LP, or any other wallet
cannot move the buyer's USDC. A repayment before `Confirmed` is rejected by the
contract, and a repayment after `Repaid` is rejected because the status has
already advanced.

## Verify with the API or SDK

Fetch the invoice after repayment:

```bash
curl -s "$API_BASE_URL/invoices/$INVOICE_ID" | jq
```

Expected fields include:

```json
{
  "id": "9c4e1f0a7b3d52e8c6a1f4b09d7e3a5c2f8b6d0e4a19c7f3b5d2e8a6c0f4b1d9",
  "issuer": "GCV5ODH3SMUDETURTOQPQ7TD2YI4YS6DZMMXDFLSWLGBFZTCHYL6LDNW",
  "buyer": "GDSCOJVNZ4JUVWZ5O6VBTUGOH4ZE22QJ6WMOYWHB3FEDQ2APJ2RQEIHY",
  "face_value": "100000000000",
  "discount_bps": 200,
  "funded_amount": "98000000000",
  "status": "Repaid",
  "buyer_confirmed": true,
  "issuer_confirmed": true,
  "buyer_confirmed_at": 1790900000,
  "repaid_at": 1791000000
}
```

Direct SDK callers must set the allowance before repaying:

```ts
import { InvoiceClient, TokenClient, getSorobanServer } from "@trusttrove/sdk";

const invoiceClient = new InvoiceClient(invoiceContractId);
const usdc = TokenClient.forUSDC();
const invoice = await invoiceClient.get(invoiceId, buyerPublicKey);

if (
  (await usdc.allowance(buyerPublicKey, invoiceContractId, buyerPublicKey)) <
  invoice.faceValue
) {
  const latestLedger = await getSorobanServer().getLatestLedger();
  await usdc.approve(
    buyerPublicKey,
    invoiceContractId,
    invoice.faceValue,
    latestLedger.sequence + 535_680,
    buyerPublicKey,
  );
}

await invoiceClient.repay(invoiceId, buyerPublicKey);
```

The web app's `useTokenAllowance` hook wraps the same check-and-approve flow.
The SDK reports `SimulationError`, `TransactionFailedError`,
`TransactionTimeoutError`, and related typed errors; see the
[SDK Reference](../developer-guide/sdk-reference.md#error-handling).

## Related reading

- [Invoice Lifecycle](../protocol/invoice-lifecycle.md)
- [Reconcile an Invoice](../for-smes/reconcile-invoice.md)
- [Indexer API Reference](../developer-guide/indexer-api-reference.md)
- [Webhooks](../webhooks.md) — `invoice.repaid` is emitted after repayment
