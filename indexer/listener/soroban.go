package listener

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"trusttrove/indexer/api"
	"trusttrove/indexer/config"
	"trusttrove/indexer/db"
)

// Existing declarations and listener methods remain unchanged.

func (l *EventListener) pollEvents(ctx context.Context, startLedger int32) (int32, error) {
	var contractIDs []string
	if l.cfg.RegistryContractID != "" {
		contractIDs = append(contractIDs, l.cfg.RegistryContractID)
	}
	if l.cfg.InvoiceContractID != "" {
		contractIDs = append(contractIDs, l.cfg.InvoiceContractID)
	}
	if l.cfg.PoolContractID != "" {
		contractIDs = append(contractIDs, l.cfg.PoolContractID)
	}
	if l.cfg.EscrowContractID != "" {
		contractIDs = append(contractIDs, l.cfg.EscrowContractID)
	}

	if len(contractIDs) == 0 {
		slog.Warn("No contract IDs configured for indexing. Advancing start ledger sequence to chain tip.")
		latest, err := l.getLatestLedgerSequence(ctx)
		if err != nil {
			return startLedger, err
		}
		return latest + 1, nil
	}

	filters := []EventFilter{{Type: "contract", ContractIDs: contractIDs}}
	cursor := ""
	var latestLedgerSeq int32
	var events []SorobanEvent

	for {
		params := GetEventsParams{
			StartLedger: startLedger,
			Filters:     filters,
			Pagination: &PaginationParams{Limit: 100, Cursor: cursor},
		}

		var res GetEventsResult
		if err := api.CallSorobanRPC(ctx, l.cfg.SorobanRPCURL, "getEvents", params, &res); err != nil {
			return startLedger, fmt.Errorf("call getEvents (startLedger=%d, cursor=%s): %w", startLedger, cursor, err)
		}

		if res.LatestLedger != 0 {
			latestLedgerSeq = int32(res.LatestLedger)
		}
		for _, ev := range res.Events {
			events = append(events, SorobanEvent{
				ID:             ev.ID,
				ContractID:     ev.ContractID,
				Ledger:         ev.Ledger,
				LedgerClosedAt: ev.LedgerClosedAt,
				Topic:          ev.Topic,
				Value:          ev.Value.Xdr,
			})
		}

		if res.Cursor != "" && len(res.Events) > 0 {
			cursor = res.Cursor
		} else {
			break
		}
	}

	ids := make([]string, 0, len(events))
	for _, event := range events {
		ids = append(ids, event.ID)
	}
	processed, err := db.AreEventsProcessed(ctx, ids)
	if err != nil {
		slog.Error("Failed to check if events are processed", "error", err)
		processed = make(map[string]bool)
	}

	for _, event := range events {
		if processed[event.ID] {
			continue
		}
		if err := l.handleEvent(ctx, event); err != nil {
			return startLedger, fmt.Errorf("handle event %s: %w", event.ID, err)
		}
	}

	if latestLedgerSeq >= startLedger {
		return latestLedgerSeq + 1, nil
	}
	return startLedger, nil
}
