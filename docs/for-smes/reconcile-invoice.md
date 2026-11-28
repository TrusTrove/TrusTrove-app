# Reconcile an Invoice

This walkthrough is for an SME reconciling a normally repaid invoice: the buyer
paid the full face value on time, the pool received the money, and the invoice
is closed. It shows the exact amounts, the on-chain actions, the API fields, and
an illustrative accounting treatment you can compare with your own books.

This page documents existing behavior; it does not add a new public command,
endpoint, or UI control.

The lifecycle states and contract calls are defined in
[Invoice Lifecycle](../protocol/invoice-lifecycle.md) and
[invoice_contract](../smart-contracts/invoice-contract.md).

## The worked invoice

| Term                          | Value                                |
| ----------------------------- | ------------------------------------ |
| Face value                    | 10,000.00 USDC                       |
| Discount                      | 200 bps (2.00%)                      |
| Amount paid to you at funding | 9,800.00 USDC                        |
| Your financing cost           | 200.00 USDC                          |
| Term                          | 60 days                              |
| Due date                      | 2026-10-31 09:00 UTC                 |
| Repayment date                | 2026-10-30 11:20 UTC (one day early) |
| Buyer repayment               | 10,000.00 USDC to the pool           |

Amounts are stored in stroops (1 USDC = 10,000,000 stroops):

| Term          | Stroops        |
| ------------- | -------------- |
| Face value    | `100000000000` |
| Funded amount | `98000000000`  |
| Discount      | `2000000000`   |

The formulas are:

```
discount       = face_value × discount_bps / 10000
funded_amount  = face_value - discount
```

For this invoice: `10,000.00 × 200 / 10000 = 200.00`, and
`10,000.00 - 200.00 = 9,800.00`.

## On-chain actions and API status

The normal path is:

```
Created → Listed → Funded → Active → Confirmed → Repaid
```

| Step    | Who acts  | Contract call                                  | Status after | API timestamp set    |
| ------- | --------- | ---------------------------------------------- | ------------ | -------------------- |
| Create  | Issuer    | `create(issuer, buyer, face_value, due_date)`  | `Created`    | `created_at`         |
| List    | Issuer    | `list_for_financing(invoice_id, discount_bps)` | `Listed`     | —                    |
| Fund    | Pool / LP | `pool_contract.fund_invoice(invoice_id)`       | `Funded`     | `funded_at`          |
| Ship    | Issuer    | `mark_shipped(invoice_id)`                     | `Active`     | `shipped_at`         |
| Confirm | Buyer     | `confirm_delivery(invoice_id, confirmer)`      | `Confirmed`  | `buyer_confirmed_at` |
| Repay   | Buyer     | `repay(invoice_id)`                            | `Repaid`     | `repaid_at`          |

The API sets `issuer_confirmed` when the shipment is indexed, so the buyer's
confirmation is the final delivery step shown in the current UI. A stored
attestation is also required before listing; it does not affect the repayment
amounts.

In the current web app, the issuer creates the invoice from **Create Invoice**,
optionally listing it at the same time with **List for immediate LP financing at
creation**. Once it is funded, the issuer clicks **MARK GOODS SHIPPED** on the
invoice detail page. The buyer clicks **CONFIRM DELIVERY**, then **REPAY
INVOICE**. The issuer does not receive or sign the repayment transaction.

At funding, `fund_invoice` locks the funded amount in escrow and immediately
releases it to the issuer in the same transaction. At repayment, the buyer sends
the full face value to the pool, and `invoice_contract` calls
`pool_contract.receive_repayment(invoice_id, amount)`. The pool keeps the
discount as yield for LPs.

## API response after repayment

Fetch the invoice:

```bash
curl -s "$API_BASE_URL/invoices/$INVOICE_ID" | jq
```

A reconciled, repaid invoice looks like this:

```json
{
  "id": "9c4e1f0a7b3d52e8c6a1f4b09d7e3a5c2f8b6d0e4a19c7f3b5d2e8a6c0f4b1d9",
  "issuer": "GCV5ODH3SMUDETURTOQPQ7TD2YI4YS6DZMMXDFLSWLGBFZTCHYL6LDNW",
  "buyer": "GDSCOJVNZ4JUVWZ5O6VBTUGOH4ZE22QJ6WMOYWHB3FEDQ2APJ2RQEIHY",
  "face_value": "100000000000",
  "discount_bps": 200,
  "funded_amount": "98000000000",
  "due_date": 1793437200,
  "status": "Repaid",
  "created_at": 1788253200,
  "funded_at": 1788359400,
  "shipped_at": 1788602400,
  "issuer_confirmed": true,
  "buyer_confirmed": true,
  "buyer_confirmed_at": 1788885900,
  "repaid_at": 1793359200,
  "attestation_agent_id": "underwrite-v1",
  "risk_score_bps": 180,
  "evidence_hash": "b1946ac92492d2347c6235b4d2611184c0f4b9a5f0f0b1e2d3c4b5a697887766",
  "attested_at": 1788300000
}
```

Field meanings for reconciliation:

| Field                | Use                                             |
| -------------------- | ----------------------------------------------- |
| `face_value`         | The amount the buyer owed and the pool received |
| `discount_bps`       | The rate you set when listing; 200 = 2.00%      |
| `funded_amount`      | The cash you received at funding                |
| `funded_at`          | When the cash event occurred                    |
| `shipped_at`         | When you marked the goods shipped               |
| `buyer_confirmed_at` | When the buyer confirmed delivery               |
| `repaid_at`          | When the buyer's repayment settled              |
| `status`             | Must be `Repaid` for a normal completed invoice |

`issuer_confirmed` becomes `true` when you mark the invoice shipped;
`buyer_confirmed` becomes `true` when the buyer confirms delivery. Both must be
true before repayment is allowed.

## Accounting reconciliation

The issuer's cash event is **funding**, not repayment. The buyer repays the
pool, so no money arrives in the issuer's account at maturity. The repayment
confirms that the receivable you sold at funding has been settled and the
invoice is closed.

The entries below assume the underlying sale was already recorded when the
invoice was created:

| Event                                   | Debit                                    | Credit                        |
| --------------------------------------- | ---------------------------------------- | ----------------------------- |
| Invoice created (already on your books) | Accounts receivable 10,000.00            | Revenue 10,000.00             |
| Invoice funded                          | Cash 9,800.00 + Financing expense 200.00 | Accounts receivable 10,000.00 |
| Buyer repays the pool                   | No issuer entry                          | —                             |

After the funding entry, the receivable is off your books, cash is up 9,800.00,
and the 200.00 discount is recognized as financing expense. At repayment there
is nothing left to collect or reverse.

If your policy is to amortize financing costs over the invoice term instead of
expensing them at funding, record the 200.00 as a deferred financing cost at
funding and amortize it over the 60 days (approximately 3.33 per day). The total
expense is still 200.00. Use one method consistently; this example is
illustrative, not tax or accounting advice.

### Reconciliation worksheet

| Check                       | Source                       | Value                       |
| --------------------------- | ---------------------------- | --------------------------- |
| Face value                  | `face_value`                 | 10,000.00                   |
| Cash received at funding    | Bank / Stellar account       | 9,800.00                    |
| Discount                    | `face_value - funded_amount` | 200.00                      |
| Cash received at repayment  | Bank / Stellar account       | 0.00                        |
| Cash plus discount          | 9,800.00 + 200.00            | 10,000.00                   |
| Variance against face value | —                            | 0.00                        |
| Settlement status           | `status`, `repaid_at`        | `Repaid`, timestamp present |

If the variance is not zero, do not plug the difference into the ledger. Check
`discount_bps`, `funded_amount`, and whether the invoice was actually funded.
The invoice API does not expose a per-invoice funding transaction hash, so match
the cash receipt by `funded_at`, amount, and the corresponding on-chain event in
`GET /events`.

### Period-end pull

List the invoices you originated and filter by status:

```bash
curl -s "$API_BASE_URL/invoices?issuer=$ISSUER_ADDRESS&status=Repaid&limit=100&page=1" | jq
```

The response has `data`, `total`, `page`, `limit`, and `totalPages`. Paginate
with `page` until you have all rows; `limit` is capped at 100. For each invoice:

- add `funded_amount` to cash received in the funding period;
- add `face_value - funded_amount` to financing expense;
- confirm `status` is `Repaid` and `repaid_at` falls in the period you are
  reviewing.

The PDF from **Download PDF** on the invoice detail page is a convenient audit
record: it includes the invoice ID, status, face value, discount, funded amount,
parties, due date, and status timeline.

## Boundary cases

### Empty result

An issuer with no repaid invoices in the period gets:

```json
{
  "data": [],
  "total": 0,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

That is an empty state, not an error. Post no financing entries for it.

### Not funded, not repaid, or invalid

| State                                        | What it means for the books                                                                                                                                       |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Created` or `Listed`, `funded_amount` `"0"` | No cash received and no receivable sold. Do not recognize financing expense.                                                                                      |
| `Funded`, `Active`, or `Confirmed`           | Cash was received at `funded_at`; the invoice is still outstanding. Recognize the funding entry, but not repayment until `Repaid`.                                |
| `Defaulted`                                  | The buyer did not repay. The pool takes the principal loss; the issuer does not return the funded amount. Do not treat it as repaid or reverse the funding entry. |
| `Repaid` with `repaid_at` missing            | Inconsistent indexer state. Wait and refetch; do not book repayment until the timestamp is present and the status is stable.                                      |
| Amounts do not reconcile                     | Stop and inspect `discount_bps`, `funded_amount`, and the funding event. Do not force a balancing entry.                                                          |

A cancelled or never-funded invoice should not appear in a funding reconciliation
at all: no `funded_at`, no `funded_amount`, and no cash.

### Permission and ownership

- `GET /invoices` and `GET /invoices/:id` are public reads. Filter by `issuer`
  to avoid mixing another company's invoices into your reconciliation.
- `POST /invoices` requires a JWT and creates the invoice for the authenticated
  issuer. A JWT for one address cannot create an invoice for another issuer.
- Only the buyer can call `repay` and move USDC to the pool. The issuer cannot
  repay on the buyer's behalf. Delivery confirmation is recorded for both
  parties: in the current UI the issuer's side comes from **MARK GOODS SHIPPED**
  and the buyer's from **CONFIRM DELIVERY**.
- Repayment is final. A second `repay` for a `Repaid` invoice is rejected by the
  contract; do not record a second cash receipt.

## Related reading

- [Invoice Lifecycle](../protocol/invoice-lifecycle.md) — every state and transition
- [Create Your First Invoice](create-your-first-invoice.md) — the issuer UI flow
- [Understanding the Discount](understanding-the-discount.md) — how the 200.00 is set
- [Repay an Invoice](../for-buyers/repay-an-invoice.md) — the buyer's side
- [Indexer API Reference](../developer-guide/indexer-api-reference.md#get-invoices) — filters and pagination
