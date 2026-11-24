package db

import (
	"context"
	"fmt"
)

type BuyerInvoiceSummary struct {
	Buyer           string `json:"buyer"`
	ConfirmedTotal  string `json:"confirmed_total"`
	ConfirmedCount  int    `json:"confirmed_count"`
	DueSoonTotal    string `json:"due_soon_total"`
	DueSoonCount    int    `json:"due_soon_count"`
	OverdueTotal    string `json:"overdue_total"`
	OverdueCount    int    `json:"overdue_count"`
	RepaidTotal     string `json:"repaid_total"`
	RepaidCount     int    `json:"repaid_count"`
}

// GetBuyerInvoiceSummary calculates counts and face value/funded totals for confirmed,
// due soon (due within the next 7 days, i.e., between now and now + 604800 seconds),
// overdue (due before now and not repaid/cancelled/defaulted), and repaid invoices
// for a single buyer address, using exact decimal strings for monetary amounts.
func GetBuyerInvoiceSummary(ctx context.Context, buyerAddress string, now int64) (*BuyerInvoiceSummary, error) {
	const query = `
		SELECT
			COALESCE(SUM(face_value) FILTER (WHERE status = 'Confirmed'), 0)::TEXT,
			COALESCE(COUNT(*) FILTER (WHERE status = 'Confirmed'), 0),
			COALESCE(SUM(face_value) FILTER (WHERE due_date >= $2 AND due_date <= $2 + 604800 AND status NOT IN ('Repaid', 'Cancelled', 'Defaulted')), 0)::TEXT,
			COALESCE(COUNT(*) FILTER (WHERE due_date >= $2 AND due_date <= $2 + 604800 AND status NOT IN ('Repaid', 'Cancelled', 'Defaulted')), 0),
			COALESCE(SUM(face_value) FILTER (WHERE due_date < $2 AND status NOT IN ('Repaid', 'Cancelled', 'Defaulted')), 0)::TEXT,
			COALESCE(COUNT(*) FILTER (WHERE due_date < $2 AND status NOT IN ('Repaid', 'Cancelled', 'Defaulted')), 0),
			COALESCE(SUM(face_value) FILTER (WHERE status = 'Repaid'), 0)::TEXT,
			COALESCE(COUNT(*) FILTER (WHERE status = 'Repaid'), 0)
		FROM invoices
		WHERE buyer = $1
	`

	summary := &BuyerInvoiceSummary{Buyer: buyerAddress}
	err := Pool.QueryRow(ctx, query, buyerAddress, now).Scan(
		&summary.ConfirmedTotal,
		&summary.ConfirmedCount,
		&summary.DueSoonTotal,
		&summary.DueSoonCount,
		&summary.OverdueTotal,
		&summary.OverdueCount,
		&summary.RepaidTotal,
		&summary.RepaidCount,
	)
	if err != nil {
		return nil, fmt.Errorf("queries: get buyer invoice summary: %w", err)
	}
	return summary, nil
}
