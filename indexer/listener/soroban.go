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

// SorobanEvent represents a normalized event emitted by a Soroban contract
type SorobanEvent struct {
	ID             string   `json:"id"`
	ContractID     string   `json:"contractId"`
	Ledger         int32    `json:"ledger"`
	LedgerClosedAt string   `json:"ledgerClosedAt"`
	Topic          []string `json:"topic"`
	Value          string   `json:"value"` // base64-encoded ScVal XDR
}

// rpcEvent matches the Soroban RPC getEvents response structure
type rpcEvent struct {
	Type           string   `json:"type"`
	Ledger         int32    `json:"ledger"`
	LedgerClosedAt string   `json:"ledgerClosedAt"`
	ContractID     string   `json:"contractId"`
	ID             string   `json:"id"`
	PagingToken    string   `json:"pagingToken"`
	Topic          []string `json:"topic"`
	Value          struct {
		Xdr string `json:"xdr"`
	} `json:"value"`
}

// GetEventsResult represents the result field of getEvents RPC response
type GetEventsResult struct {
	LatestLedger uint32     `json:"latestLedger"`
	Events       []rpcEvent `json:"events"`
	Cursor       string     `json:"cursor"`
}

// GetLatestLedgerResult represents the result field of getLatestLedger RPC response
type GetLatestLedgerResult struct {
	ID              string `json:"id"`
	Sequence        int32  `json:"sequence"`
	CloseTime       string `json:"closeTime"`
	ProtocolVersion int    `json:"protocolVersion"`
}

// EventFilter represents the filter structure for getEvents RPC
type EventFilter struct {
	Type        string   `json:"type"`
	ContractIDs []string `json:"contractIds,omitempty"`
	Topics      []string `json:"topics,omitempty"`
}

// PaginationParams represents pagination parameters for getEvents RPC
type PaginationParams struct {
	Cursor string `json:"cursor,omitempty"`
	Limit  int    `json:"limit,omitempty"`
}

// GetEventsParams represents request parameters for getEvents RPC
type GetEventsParams struct {
	StartLedger int32             `json:"startLedger"`
	Filters     []EventFilter     `json:"filters,omitempty"`
	Pagination  *PaginationParams `json:"pagination,omitempty"`
}

// EventListener listens to Soroban events and routes them to database and state synchronizers
type EventListener struct {
	cfg *config.Config
}

// NewEventListener constructs a new EventListener
func NewEventListener(cfg *config.Config) *EventListener {
	return &EventListener{cfg: cfg}
}

// getLatestLedgerSequence fetches the latest ledger sequence number from the Soroban RPC
func (l *EventListener) getLatestLedgerSequence(ctx context.Context) (int32, error) {
	var res GetLatestLedgerResult
	err := api.CallSorobanRPC(l.cfg.SorobanRPCURL, "getLatestLedger", nil, &res)
	if err != nil {
		return 0, fmt.Errorf("call getLatestLedger: %w", err)
	}
	return res.Sequence, nil
}

// Start starts the event listening loop
func (l *EventListener) Start(ctx context.Context) error {
	// 1. Determine start ledger sequence
	// Prefer checkpoint for accurate resume across empty-ledger ranges
	currentLedger, err := db.GetCheckpoint(ctx)
	if err != nil {
		return fmt.Errorf("failed to get checkpoint: %w", err)
	}

	if currentLedger > 0 {
		slog.Info("Resuming event indexing from checkpoint", "startLedger", currentLedger)
	} else {
		// Fallback: use MAX(ledger) from events_log for backward compatibility
		startLedger, err := db.GetLatestProcessedLedger(ctx)
		if err != nil {
			return fmt.Errorf("failed to get latest processed ledger: %w", err)
		}
		if startLedger > 0 {
			currentLedger = startLedger + 1
			slog.Info("Resuming event indexing from events_log", "startLedger", currentLedger)
		} else {
			latest, err := l.getLatestLedgerSequence(ctx)
			if err != nil {
				return fmt.Errorf("failed to get latest ledger sequence: %w", err)
			}
			currentLedger = latest
			slog.Info("Starting event indexing from latest chain ledger", "startLedger", currentLedger)
		}
	}

	pollInterval := time.Duration(l.cfg.IndexerPollIntervalMs) * time.Millisecond
	if pollInterval <= 0 {
		pollInterval = 5 * time.Second
	}

	ticker := time.NewTicker(pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("Event listener stopping...")
			return nil
		case <-ticker.C:
			nextLedger, err := l.pollEvents(ctx, currentLedger)
			if err != nil {
				slog.Error("Error polling events", "error", err)
				// Retry from the same ledger on the next tick
				continue
			}
			currentLedger = nextLedger

			// Persist checkpoint so restart resumes from this exact ledger
			if err := db.UpsertCheckpoint(ctx, currentLedger); err != nil {
				slog.Error("Failed to save checkpoint", "ledger", currentLedger, "error", err)
			}
		}
	}
}

// pollEvents queries getEvents, processes results, updates DB and checkpoints, and returns the next start ledger sequence
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

	filters := []EventFilter{
		{
			Type:        "contract",
			ContractIDs: contractIDs,
		},
	}

	cursor := ""
	var latestLedgerSeq int32 = 0

	for {
		params := GetEventsParams{
			StartLedger: startLedger,
			Filters:     filters,
			Pagination: &PaginationParams{
				Limit:  100,
				Cursor: cursor,
			},
		}

		var res GetEventsResult
		err := api.CallSorobanRPC(l.cfg.SorobanRPCURL, "getEvents", params, &res)
		if err != nil {
			return startLedger, fmt.Errorf("call getEvents (startLedger=%d, cursor=%s): %w", startLedger, cursor, err)
		}

		if res.LatestLedger != 0 {
			latestLedgerSeq = int32(res.LatestLedger)
		}

		for _, ev := range res.Events {
			sorobanEv := SorobanEvent{
				ID:             ev.ID,
				ContractID:     ev.ContractID,
				Ledger:         ev.Ledger,
				LedgerClosedAt: ev.LedgerClosedAt,
				Topic:          ev.Topic,
				Value:          ev.Value.Xdr,
			}

			processed, err := db.IsEventProcessed(ctx, sorobanEv.ID)
			if err != nil {
				slog.Error("Failed to check if event is processed", "eventId", sorobanEv.ID, "error", err)
			}
			if processed {
				continue
			}

			err = l.handleEvent(ctx, sorobanEv)
			if err != nil {
				return startLedger, fmt.Errorf("handle event %s: %w", sorobanEv.ID, err)
			}
		}

		if res.Cursor != "" && len(res.Events) > 0 {
			cursor = res.Cursor
		} else {
			break
		}
	}

	if latestLedgerSeq >= startLedger {
		return latestLedgerSeq + 1, nil
	}
	return startLedger, nil
}
