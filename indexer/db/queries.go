package db

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
)

// Existing declarations and query functions remain unchanged.

func AreEventsProcessed(ctx context.Context, ids []string) (map[string]bool, error) {
	processed := make(map[string]bool, len(ids))
	if len(ids) == 0 {
		return processed, nil
	}

	query := `SELECT event_id FROM events_log WHERE event_id = ANY($1)`
	rows, err := Pool.Query(ctx, query, ids)
	if err != nil {
		return nil, fmt.Errorf("queries: are events processed: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var eventID string
		if err := rows.Scan(&eventID); err != nil {
			return nil, fmt.Errorf("queries: scan processed event: %w", err)
		}
		processed[eventID] = true
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("queries: iterate processed events: %w", err)
	}
	return processed, nil
}
