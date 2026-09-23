package listener

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"trusttrove/indexer/api"
	"trusttrove/indexer/config"
	"trusttrove/indexer/db"
	"trusttrove/indexer/soroban"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/stellar/go-stellar-sdk/keypair"
)

var (
	pollIterations = promauto.NewCounter(prometheus.CounterOpts{
		Name: "trusttrove_indexer_poll_iterations_total",
		Help: "Total number of event polling iterations.",
	})
	eventsProcessed = promauto.NewCounter(prometheus.CounterOpts{
		Name: "trusttrove_indexer_events_processed_total",
		Help: "Total number of events processed.",
	})
	rpcFailures = promauto.NewCounter(prometheus.CounterOpts{
		Name: "trusttrove_indexer_rpc_failures_total",
		Help: "Total number of RPC call failures.",
	})
	currentLedgerGauge = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "trusttrove_indexer_current_ledger",
		Help: "The current ledger sequence being processed by the indexer.",
	})
)

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

type GetEventsResult struct {
	LatestLedger uint32     `json:"latestLedger"`
	Events       []rpcEvent `json:"events"`
	Cursor       string     `json:"cursor"`
}

type GetLatestLedgerResult struct {
	ID              string `json:"id"`
	Sequence        int32  `json:"sequence"`
	CloseTime       string `json:"closeTime"`
	ProtocolVersion int    `json:"protocolVersion"`
}

type EventFilter struct {
	Type        string   `json:"type"`
	ContractIDs []string `json:"contractIds,omitempty"`
	Topics      []string `json:"topics,omitempty"`
}

type PaginationParams struct {
	Cursor string `json:"cursor,omitempty"`
	Limit  int    `json:"limit,omitempty"`
}

type GetEventsParams struct {
	StartLedger int32             `json:"startLedger"`
	Filters     []EventFilter     `json:"filters,omitempty"`
	Pagination  *PaginationParams `json:"pagination,omitempty"`
}

type EventListener struct {
	cfg    *config.Config
	health *api.ListenerHealth

	// dependency-injectable storage helpers. Defaults are wired in
	// NewEventListener so production behavior is unchanged; tests in this
	// package can override individual fields to avoid requiring a live DB
	// for the bookkeeping paths.
	getCheckpointFn            func(context.Context) (int32, error)
	getLatestProcessedLedgerFn func(context.Context) (int32, error)
	upsertCheckpointFn         func(context.Context, int32) error
	isEventProcessedFn         func(context.Context, string) (bool, error)
}

func NewEventListener(cfg *config.Config, health *api.ListenerHealth) *EventListener {
	return &EventListener{
		cfg:                        cfg,
		health:                     health,
		getCheckpointFn:            db.GetCheckpoint,
		getLatestProcessedLedgerFn: db.GetLatestProcessedLedger,
		upsertCheckpointFn:         db.UpsertCheckpoint,
		isEventProcessedFn:         db.IsEventProcessed,
	}
}

func (l *EventListener) getLatestLedgerSequence(ctx context.Context) (int32, error) {
	var res GetLatestLedgerResult
	if err := soroban.CallSorobanRPC(ctx, l.cfg.SorobanRPCURL, "getLatestLedger", nil, &res); err != nil {
		rpcFailures.Inc()
		return 0, fmt.Errorf("call getLatestLedger: %w", err)
	}
	return res.Sequence, nil
}

func (l *EventListener) Start(ctx context.Context) error {
	if l.health != nil {
		l.health.MarkStarted()
	}

	if l.cfg.ServerSeed == "" {
		return fmt.Errorf("ServerSeed is required when event listener is enabled")
	}
	if _, err := keypair.ParseFull(l.cfg.ServerSeed); err != nil {
		return fmt.Errorf("invalid ServerSeed configuration: %w", err)
	}

	// 1. Determine start ledger sequence
	// Prefer checkpoint for accurate resume across empty-ledger ranges
	currentLedger, err := l.getCheckpointFn(ctx)
	if err != nil {
		return fmt.Errorf("failed to get checkpoint: %w", err)
	}
	if currentLedger > 0 {
		slog.Info("Resuming event indexing from checkpoint", "startLedger", currentLedger)
	} else {
		// Fallback: use MAX(ledger) from events_log for backward compatibility
		startLedger, err := l.getLatestProcessedLedgerFn(ctx)
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
			if l.health != nil {
				l.health.MarkStopped()
			}
			return nil
		case <-ticker.C:
			currentLedgerGauge.Set(float64(currentLedger))
			nextLedger, err := l.pollEvents(ctx, currentLedger)
			if err != nil {
				slog.Error("Error polling events", "error", err)
				if l.health != nil {
					l.health.MarkStopped()
				}
				return fmt.Errorf("listener poll failed: %w", err)
			}
			if l.health != nil {
				l.health.MarkHeartbeat()
			}
			currentLedger = nextLedger

			// Persist checkpoint so restart resumes from this exact ledger
			if err := l.upsertCheckpointFn(ctx, currentLedger); err != nil {
				slog.Error("Failed to save checkpoint", "ledger", currentLedger, "error", err)
			}
		}
	}
}

func (l *EventListener) pollEvents(ctx context.Context, startLedger int32) (int32, error) {
	pollIterations.Inc()
	return l.FetchAndProcessRange(ctx, startLedger, 0)
}

// FetchAndProcessRange fetches and processes events from startLedger up to endLedger (inclusive).
// If endLedger is 0, it fetches up to the current chain tip.
func (l *EventListener) FetchAndProcessRange(ctx context.Context, startLedger, endLedger int32) (int32, error) {
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
		if l.health != nil {
			l.health.UpdateLedgers(latest, latest)
		}
		return latest + 1, nil
	}

	filters := []EventFilter{{Type: "contract", ContractIDs: contractIDs}}
	cursor := ""
	var latestLedgerSeq int32
	
	for {
		params := GetEventsParams{
			StartLedger: startLedger,
			Filters:     filters,
			Pagination:  &PaginationParams{Limit: 100, Cursor: cursor},
		}
		var res GetEventsResult
		if err := soroban.CallSorobanRPC(ctx, l.cfg.SorobanRPCURL, "getEvents", params, &res); err != nil {
			rpcFailures.Inc()
			return startLedger, fmt.Errorf("call getEvents (startLedger=%d, cursor=%s): %w", startLedger, cursor, err)
		}
		if res.LatestLedger != 0 {
			latestLedgerSeq = int32(res.LatestLedger)
		}
		for _, ev := range res.Events {
			if endLedger > 0 && ev.Ledger > endLedger {
				break
			}
			sorobanEv := SorobanEvent{
				ID:             ev.ID,
				ContractID:     ev.ContractID,
				Ledger:         ev.Ledger,
				LedgerClosedAt: ev.LedgerClosedAt,
				Topic:          ev.Topic,
				Value:          ev.Value.Xdr,
			}

			processed, err := l.isEventProcessedFn(ctx, sorobanEv.ID)
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
			eventsProcessed.Inc()
		}
		
		if endLedger > 0 && len(res.Events) > 0 && res.Events[len(res.Events)-1].Ledger > endLedger {
			break
		}

		if res.Cursor != "" && len(res.Events) > 0 {
			cursor = res.Cursor
		} else {
			break
		}
	}

	if l.health != nil {
		if latestLedgerSeq > 0 {
			if latestLedgerSeq >= startLedger {
				l.health.UpdateLedgers(latestLedgerSeq, latestLedgerSeq)
			} else {
				l.health.UpdateLedgers(startLedger-1, latestLedgerSeq)
			}
		}
	}

	if endLedger > 0 {
		if endLedger >= startLedger {
			return endLedger + 1, nil
		}
		return startLedger, nil
	}

	if latestLedgerSeq >= startLedger {
		return latestLedgerSeq + 1, nil
	}
	return startLedger, nil
}
