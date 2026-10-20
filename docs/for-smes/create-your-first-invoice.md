# Create Your First Invoice

From the SME Dashboard, click **Create Invoice**.

### Step 1 — Fill in the details

- **Buyer address** — the Stellar address of your buyer. They must be registered.
- **Face value** — the total amount the buyer owes, in USDC.
- **Due date** — when the buyer will repay. Minimum 7 days, maximum 365 days.

As you fill in the details, the form shows a live preview driven by the
**Financing Discount Rate** slider below the fields:

- **Financing Discount Rate slider** — you pick the discount, from 0.5%
  (50 bps) to 5.0% (500 bps) in 0.1% steps; default 2.0% (200 bps).
  There is no pool-set rate — the SME sets it.
- You receive today: $X,XXX.XX (face value minus your chosen discount)
- Buyer repays: $X,XXX.XX on [due date]
- Your cost: $XX.XX

> The 5% slider ceiling is a UI limit. The contract accepts up to 50%
> (5000 bps) — see [Understanding the Discount](./understanding-the-discount.md).

Below the slider is a checkbox, **"List for immediate LP financing at
creation"**, checked by default. It controls two paths:

- **Checked (default) — create and list in one flow.** After the invoice is
  created, the form simulates `list_for_financing` with your slider discount
  and then submits the listing. If listing fails (e.g. the Underwrite risk
  check hasn't finished — see below), the form automatically cancels the
  just-created invoice so it doesn't sit in `Created` limbo.
- **Unchecked — create only.** The invoice is created in `Created` status and
  stays unlisted until you list it separately from the invoice detail page
  (Step 3).

### Step 2 — Review and sign

Check the summary screen (it shows the discount and net payout when
immediate-list is on). Clicking create sends an off-chain `POST /invoices`
request to the indexer, which simulates the `create` call, signs it with the
indexer's server key, and submits it on-chain — so **creation itself does not
prompt a Freighter signature**. The Freighter prompt you see is for the
**listing** step (`list_for_financing`), which is signed by your wallet.
Once created, the invoice's face value, buyer, and due date cannot be changed.

### Step 3 — List for financing (only if you unchecked the box)

After creation, the invoice is in `Created` status. Go to the invoice detail page
and click **List for Financing**. Set your discount rate — the amount you are
willing to give up to get paid today. (If you left the checkbox on, this step
already happened automatically.)

Before an invoice can be listed, it is automatically checked against Underwrite's
risk assessment. If that check hasn't finished yet, listing will be blocked for a
few minutes — wait and try again. Once the check passes, the invoice is ready to
list.

Lower discount = cheaper but may take longer to fund.
Higher discount = more expensive but attracts funders faster.

Once listed, the invoice appears in the marketplace and can be funded by the pool.

### Step 4 — Ship and confirm

After the invoice is funded and you receive USDC, ship your goods or deliver your
service. Then click **Mark as Shipped** in the dashboard.

### Step 5 — Confirm delivery

Both you and your buyer need to confirm delivery. Ask your buyer to log in to
TrusTrove and click **Confirm Delivery** on the invoice.

Once both confirmations are recorded, the invoice is ready for repayment.
