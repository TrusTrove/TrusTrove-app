package db

import (
	"context"
	"fmt"
	"strings"
)

// GetInvoicesPageFiltered returns a paginated list of invoices matching the optional status, issuer, and asset filters.
func GetInvoicesPageFiltered(ctx context.Context, status, issuer, asset string, limit, offset int) ([]*DbInvoice, int, error) {
	if Pool == nil {
		return nil, 0, fmt.Errorf("database pool not initialized")
	}

	predicates := make([]string, 0, 3)
	filterArgs := make([]any, 0, 3)

	if status != "" {
		predicates = append(predicates, fmt.Sprintf("status = $%d", len(filterArgs)+1))
		filterArgs = append(filterArgs, status)
	}
	if issuer != "" {
		predicates = append(predicates, fmt.Sprintf("issuer = $%d", len(filterArgs)+1))
		filterArgs = append(filterArgs, issuer)
	}
	if asset != "" {
		predicates = append(predicates, fmt.Sprintf("funding_asset = $%d", len(filterArgs)+1))
		filterArgs = append(filterArgs, asset)
	}

	whereClause := ""
	if len(predicates) > 0 {
		whereClause = " WHERE " + strings.Join(predicates, " AND ")
	}

	countQuery := "SELECT COUNT(*) FROM invoices" + whereClause
	var total int
	if err := Pool.QueryRow(ctx, countQuery, filterArgs...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("queries: count invoices: %w", err)
	}

	limitPlaceholder := len(filterArgs) + 1
	offsetPlaceholder := len(filterArgs) + 2
	query := fmt.Sprintf(`
		SELECT
			id, issuer, buyer, face_value, discount_bps, funded_amount, due_date, status, created_at,
			funded_at, shipped_at, issuer_confirmed, buyer_confirmed, buyer_confirmed_at, repaid_at,
			attestation_agent_id, risk_score_bps, evidence_hash, attested_at
		FROM invoices%s
		ORDER BY created_at DESC, id DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, limitPlaceholder, offsetPlaceholder)
	queryArgs := append(append([]any{}, filterArgs...), limit, offset)

	rows, err := Pool.Query(ctx, query, queryArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("queries: list invoices: %w", err)
	}
	defer rows.Close()

	var invoices []*DbInvoice
	for rows.Next() {
		var inv DbInvoice
		if err := rows.Scan(
			&inv.ID, &inv.Issuer, &inv.Buyer, &inv.FaceValue, &inv.DiscountBps, &inv.FundedAmount,
			&inv.DueDate, &inv.Status, &inv.CreatedAt, &inv.FundedAt, &inv.ShippedAt,
			&inv.IssuerConfirmed, &inv.BuyerConfirmed, &inv.BuyerConfirmedAt, &inv.RepaidAt,
			&inv.AttestationAgentID, &inv.RiskScoreBps, &inv.EvidenceHash, &inv.AttestedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("queries: scan invoice: %w", err)
		}
		invoices = append(invoices, &inv)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("queries: iterate invoices: %w", err)
	}

	return invoices, total, nil
}
