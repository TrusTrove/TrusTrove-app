package api

import (
	"encoding/json"
	"math/big"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"trusttrove/indexer/db"
)

// These tests keep the user-facing walkthroughs in docs/ aligned with the
// indexer responses and the current web UI. They are intentionally narrow:
// they check the worked numbers, the documented API fields, and the boundary
// cases each walkthrough promises, without duplicating the handler tests.

func readDoc(t *testing.T, rel string) string {
	t.Helper()
	path := filepath.Join("..", "..", "docs", rel)
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return string(raw)
}

// jsonBlockAfter returns the first fenced JSON block after marker.
func jsonBlockAfter(t *testing.T, doc, marker string) string {
	t.Helper()
	idx := strings.Index(doc, marker)
	if idx < 0 {
		t.Fatalf("marker %q not found in document", marker)
	}
	rest := doc[idx:]
	start := strings.Index(rest, "```json\n")
	if start < 0 {
		t.Fatalf("no JSON block after %q", marker)
	}
	rest = rest[start+len("```json\n"):]
	end := strings.Index(rest, "\n```")
	if end < 0 {
		t.Fatalf("unterminated JSON block after %q", marker)
	}
	return rest[:end]
}

func requireContains(t *testing.T, doc string, values ...string) {
	t.Helper()
	for _, value := range values {
		if !strings.Contains(doc, value) {
			t.Errorf("document is missing %q", value)
		}
	}
}

func TestPublishedWalkthroughsAreIndexed(t *testing.T) {
	summary := readDoc(t, "SUMMARY.md")
	requireContains(t, summary,
		"for-smes/reconcile-invoice.md",
		"for-buyers/repay-an-invoice.md",
		"for-lps/exit-and-liquidity.md",
		"developer-guide/webhook-operations-runbook.md",
	)

	readme := readDoc(t, "README.md")
	requireContains(t, readme, "for-buyers/repay-an-invoice.md")
}

func TestIssuerReconciliationWalkthrough(t *testing.T) {
	doc := readDoc(t, "for-smes/reconcile-invoice.md")

	requireContains(t, doc,
		"## The worked invoice",
		"## On-chain actions and API status",
		"## API response after repayment",
		"## Accounting reconciliation",
		"## Boundary cases",
		"### Empty result",
		"### Permission and ownership",
		"10,000.00 USDC",
		"9,800.00 USDC",
		"200.00 USDC",
	)

	raw := jsonBlockAfter(t, doc, "A reconciled, repaid invoice looks like this:")
	var invoice db.DbInvoice
	if err := json.Unmarshal([]byte(raw), &invoice); err != nil {
		t.Fatalf("repaid invoice example is not valid db.DbInvoice JSON: %v", err)
	}

	if invoice.Status != "Repaid" {
		t.Errorf("status: got %q, want Repaid", invoice.Status)
	}
	if invoice.FaceValue != "100000000000" {
		t.Errorf("face_value: got %q, want 100000000000", invoice.FaceValue)
	}
	if invoice.FundedAmount != "98000000000" {
		t.Errorf("funded_amount: got %q, want 98000000000", invoice.FundedAmount)
	}
	if invoice.DiscountBps != 200 {
		t.Errorf("discount_bps: got %d, want 200", invoice.DiscountBps)
	}
	if !invoice.IssuerConfirmed || !invoice.BuyerConfirmed {
		t.Errorf("confirmations: got issuer=%v buyer=%v, want both true",
			invoice.IssuerConfirmed, invoice.BuyerConfirmed)
	}
	if invoice.RepaidAt == nil {
		t.Error("repaid_at: got nil, want a repayment timestamp")
	}

	face, ok := new(big.Int).SetString(invoice.FaceValue, 10)
	if !ok {
		t.Fatalf("face_value %q is not a base-10 integer", invoice.FaceValue)
	}
	funded, ok := new(big.Int).SetString(invoice.FundedAmount, 10)
	if !ok {
		t.Fatalf("funded_amount %q is not a base-10 integer", invoice.FundedAmount)
	}
	discount := new(big.Int).Sub(face, funded)
	if discount.String() != "2000000000" {
		t.Errorf("face_value - funded_amount: got %s, want 2000000000", discount)
	}

	emptyRaw := jsonBlockAfter(t, doc, "An issuer with no repaid invoices in the period gets:")
	var empty struct {
		Data       []json.RawMessage `json:"data"`
		Total      int               `json:"total"`
		Page       int               `json:"page"`
		Limit      int               `json:"limit"`
		TotalPages int               `json:"totalPages"`
	}
	if err := json.Unmarshal([]byte(emptyRaw), &empty); err != nil {
		t.Fatalf("empty reconciliation example is not valid JSON: %v", err)
	}
	if empty.Total != 0 || len(empty.Data) != 0 {
		t.Errorf("empty example: got total=%d data=%d, want total=0 data=0", empty.Total, len(empty.Data))
	}
	if empty.Page != 1 || empty.Limit != 20 || empty.TotalPages != 1 {
		t.Errorf("empty pagination: got page=%d limit=%d totalPages=%d, want 1/20/1",
			empty.Page, empty.Limit, empty.TotalPages)
	}
}

func TestBuyerRepaymentWalkthrough(t *testing.T) {
	doc := readDoc(t, "for-buyers/repay-an-invoice.md")

	requireContains(t, doc,
		"## What you need",
		"## Expected path",
		"## What the money does",
		"## Boundary cases and failure recovery",
		"### Empty balance or empty allowance",
		"### Permission boundary",
		"Freighter",
		"Connect Wallet",
		"CONFIRM DELIVERY",
		"REPAY INVOICE",
		"Confirm Repay Invoice",
		"Transaction Pending",
		"Invoice Repaid",
		"VIEW ON STELLAR EXPERT",
		"Download PDF",
		"Allowance rejected",
		"Repayment Failed",
	)

	raw := jsonBlockAfter(t, doc, "Expected fields include:")
	var invoice db.DbInvoice
	if err := json.Unmarshal([]byte(raw), &invoice); err != nil {
		t.Fatalf("repaid invoice example is not valid db.DbInvoice JSON: %v", err)
	}

	if invoice.Status != "Repaid" {
		t.Errorf("status: got %q, want Repaid", invoice.Status)
	}
	if invoice.FaceValue != "100000000000" {
		t.Errorf("face_value: got %q, want 100000000000", invoice.FaceValue)
	}
	if invoice.FundedAmount != "98000000000" {
		t.Errorf("funded_amount: got %q, want 98000000000", invoice.FundedAmount)
	}
	if invoice.DiscountBps != 200 {
		t.Errorf("discount_bps: got %d, want 200", invoice.DiscountBps)
	}
	if !invoice.BuyerConfirmed || !invoice.IssuerConfirmed {
		t.Errorf("confirmations: got buyer=%v issuer=%v, want both true",
			invoice.BuyerConfirmed, invoice.IssuerConfirmed)
	}
	if invoice.BuyerConfirmedAt == nil || invoice.RepaidAt == nil {
		t.Errorf("timestamps: got buyer_confirmed_at=%v repaid_at=%v, want both present",
			invoice.BuyerConfirmedAt, invoice.RepaidAt)
	}
}

func TestLPExitWalkthrough(t *testing.T) {
	doc := readDoc(t, "for-lps/exit-and-liquidity.md")

	requireContains(t, doc,
		"## Share price",
		"## Utilization and available liquidity",
		"## Expected path: withdraw from the portal",
		"## Worked example",
		"## Boundary cases and failure recovery",
		"### Empty or zero position",
		"### Invalid input",
		"### Wallet, network, and permission",
		"share_price",
		"available_liquidity",
		"utilization_rate",
		"Partial withdrawals are normal",
		"5,000.00 shares × 1.0020 USDC = 5,010.00 USDC",
		"95,190.00",
		"95,000.00",
		"Withdraw Shares",
		"Confirm Withdraw LP liquidity",
		"Withdrawal Complete",
		"Withdrawal Failed",
		"Amount exceeds your redeemable shares.",
		"Enter an amount greater than zero.",
	)

	statsRows := map[string]string{}
	marker := "Using the state after the repayment above:"
	idx := strings.Index(doc, marker)
	if idx < 0 {
		t.Fatalf("marker %q not found in document", marker)
	}
	for _, line := range strings.Split(doc[idx:], "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "| `") {
			continue
		}
		parts := strings.Split(line, "|")
		if len(parts) < 4 {
			continue
		}
		field := strings.Trim(strings.TrimSpace(parts[1]), "`")
		value := strings.Trim(strings.TrimSpace(parts[2]), "`\"")
		statsRows[field] = value
	}

	wantStats := map[string]string{
		"total_deposits":          "1002000000000",
		"total_funded":            "750000000000",
		"available_liquidity":     "252000000000",
		"utilization_rate_bps":    "7485",
		"total_shares":            "1000000000000",
		"total_yield_distributed": "2000000000",
	}
	for field, want := range wantStats {
		if got := statsRows[field]; got != want {
			t.Errorf("pool stats table %s: got %q, want %q", field, got, want)
		}
	}

	raw := jsonBlockAfter(t, doc, "The position response is in stroops")
	var position struct {
		Shares       string `json:"shares"`
		USDCValue    string `json:"usdc_value"`
		YieldEarned  string `json:"yield_earned"`
		DepositCount int    `json:"deposit_count"`
	}
	if err := json.Unmarshal([]byte(raw), &position); err != nil {
		t.Fatalf("LP position example is not valid JSON: %v", err)
	}
	if position.Shares != "100000000000" {
		t.Errorf("shares: got %q, want 100000000000", position.Shares)
	}
	if position.USDCValue != "100200000000" {
		t.Errorf("usdc_value: got %q, want 100200000000", position.USDCValue)
	}
	if position.YieldEarned != "200000000" {
		t.Errorf("yield_earned: got %q, want 200000000", position.YieldEarned)
	}
	if position.DepositCount != 1 {
		t.Errorf("deposit_count: got %d, want 1", position.DepositCount)
	}
}
