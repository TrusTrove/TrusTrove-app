package db

import (
	"context"
	"encoding/base64"
	"fmt"
	"strings"
)

// GetInvoicesCursor retrieves a page of invoices using cursor-based pagination (created_at descending, id descending).
func GetInvoicesCursor(ctx context.Context, status string, issuer string, cursorStr string, limit int) ([]*DbInvoice, *string, error) {
	var lastCreatedAt int64
	var lastID string
	hasCursor := false

	if cursorStr != "" {
		decoded, err := base64.StdEncoding.DecodeString(cursorStr)
		if err != nil {
			return nil, nil, fmt.Errorf("invalid cursor: %w", err)
		}
		parts := strings.SplitN(string(decoded), ":", 2)
		if len(parts) != 2 {
			return nil, nil, fmt.Errorf("invalid cursor format")
		}
		var ca int64
		if _, err := fmt.Sscanf(parts[0], "%d", &ca); err != nil {
			return nil, nil, fmt.Errorf("invalid cursor timestamp: %w", err)
		}
		lastCreatedAt = ca
		lastID = parts[1]
		hasCursor = true
	}

	query := "SELECT id, issuer, buyer, face_value, discount_bps, funded_amount, due_date, status, created_at, funded_at, shipped_at, issuer_confirmed, buyer_confirmed, buyer_confirmed_at, repaid_at, attestation_agent_id, risk_score_bps, evidence_hash, attested_at FROM invoices WHERE 1=1"
	var args []interface{}
	argIdx := 1

	if status != "" {
		query += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, status)
		argIdx++
	}
	if issuer != "" {
		query += fmt.Sprintf(" AND issuer = $%d", argIdx)
		args = append(args, issuer)
		argIdx++
	}

	if hasCursor {
		query += fmt.Sprintf(" AND (created_at < $%d OR (created_at = $%d AND id < $%d))", argIdx, argIdx+1, argIdx+2)
		args = append(args, lastCreatedAt, lastCreatedAt, lastID)
		argIdx += 3
	}

	query += fmt.Sprintf(" ORDER BY created_at DESC, id DESC LIMIT $%d", argIdx)
	args = append(args, limit+1)

	rows, err := dbPool.Query(ctx, query, args...)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	var invoices []*DbInvoice
	for rows.Next() {
		var inv DbInvoice
		if err := rows.Scan(
			&inv.ID, &inv.Issuer, &inv.Buyer, &inv.FaceValue, &inv.DiscountBps,
			&inv.FundedAmount, &inv.DueDate, &inv.Status, &inv.CreatedAt,
			&inv.FundedAt, &inv.ShippedAt, &inv.IssuerConfirmed, &inv.BuyerConfirmed,
			&inv.BuyerConfirmedAt, &inv.RepaidAt, &inv.AttestationAgentID,
			&inv.RiskScoreBps, &inv.EvidenceHash, &inv.AttestedAt,
		); err != nil {
			return nil, nil, err
		}
		invoices = append(invoices, &inv)
	}

	var nextCursor *string
	if len(invoices) > limit {
		lastInv := invoices[limit-1]
		invoices = invoices[:limit]
		rawCursor := fmt.Sprintf("%d:%s", lastInv.CreatedAt, lastInv.ID)
		enc := base64.StdEncoding.EncodeToString([]byte(rawCursor))
		nextCursor = &enc
	}

	return invoices, nextCursor, nil
}
