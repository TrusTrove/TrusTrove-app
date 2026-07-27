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

type SorobanEvent struct { ID string `json:"id"`; ContractID string `json:"contractId"`; Ledger int32 `json:"ledger"`; LedgerClosedAt string `json:"ledgerClosedAt"`; Topic []string `json:"topic"`; Value string `json:"value"` }
type rpcEvent struct { Type string `json:"type"`; Ledger int32 `json:"ledger"`; LedgerClosedAt string `json:"ledgerClosedAt"`; ContractID string `json:"contractId"`; ID string `json:"id"`; PagingToken string `json:"pagingToken"`; Topic []string `json:"topic"`; Value struct { Xdr string `json:"xdr"` } `json:"value"` }
type GetEventsResult struct { LatestLedger uint32 `json:"latestLedger"`; Events []rpcEvent `json:"events"`; Cursor string `json:"cursor"` }
type GetLatestLedgerResult struct { ID string `json:"id"`; Sequence int32 `json:"sequence"`; CloseTime string `json:"closeTime"`; ProtocolVersion int `json:"protocolVersion"` }
type EventFilter struct { Type string `json:"type"`; ContractIDs []string `json:"contractIds,omitempty"`; Topics []string `json:"topics,omitempty"` }
type PaginationParams struct { Cursor string `json:"cursor,omitempty"`; Limit int `json:"limit,omitempty"` }
type GetEventsParams struct { StartLedger int32 `json:"startLedger"`; Filters []EventFilter `json:"filters,omitempty"`; Pagination *PaginationParams `json:"pagination,omitempty"` }
type EventListener struct { cfg *config.Config; health *api.ListenerHealth }

func NewEventListener(cfg *config.Config, health *api.ListenerHealth) *EventListener { return &EventListener{cfg: cfg, health: health} }
func (l *EventListener) getLatestLedgerSequence(ctx context.Context) (int32, error) { var res GetLatestLedgerResult; if err := api.CallSorobanRPC(ctx, l.cfg.SorobanRPCURL, "getLatestLedger", nil, &res); err != nil { return 0, fmt.Errorf("call getLatestLedger: %w", err) }; return res.Sequence, nil }

func (l *EventListener) Start(ctx context.Context) error {
	if l.health != nil { l.health.MarkStarted() }
	currentLedger, err := db.GetCheckpoint(ctx); if err != nil { return fmt.Errorf("failed to get checkpoint: %w", err) }
	if currentLedger == 0 { startLedger, err := db.GetLatestProcessedLedger(ctx); if err != nil { return fmt.Errorf("failed to get latest processed ledger: %w", err) }; if startLedger > 0 { currentLedger = startLedger + 1 } else { currentLedger, err = l.getLatestLedgerSequence(ctx); if err != nil { return fmt.Errorf("failed to get latest ledger sequence: %w", err) } } }
	pollInterval := time.Duration(l.cfg.IndexerPollIntervalMs) * time.Millisecond; if pollInterval <= 0 { pollInterval = 5 * time.Second }
	ticker := time.NewTicker(pollInterval); defer ticker.Stop()
	for { select { case <-ctx.Done(): if l.health != nil { l.health.MarkStopped() }; return nil; case <-ticker.C: nextLedger, err := l.pollEvents(ctx, currentLedger); if err != nil { if l.health != nil { l.health.MarkStopped() }; return fmt.Errorf("listener poll failed: %w", err) }; if l.health != nil { l.health.MarkHeartbeat() }; currentLedger = nextLedger; if err := db.UpsertCheckpoint(ctx, currentLedger); err != nil { slog.Error("Failed to save checkpoint", "ledger", currentLedger, "error", err) } } }
}

func (l *EventListener) pollEvents(ctx context.Context, startLedger int32) (int32, error) {
	var contractIDs []string
	if l.cfg.RegistryContractID != "" { contractIDs = append(contractIDs, l.cfg.RegistryContractID) }; if l.cfg.InvoiceContractID != "" { contractIDs = append(contractIDs, l.cfg.InvoiceContractID) }; if l.cfg.PoolContractID != "" { contractIDs = append(contractIDs, l.cfg.PoolContractID) }; if l.cfg.EscrowContractID != "" { contractIDs = append(contractIDs, l.cfg.EscrowContractID) }
	if len(contractIDs) == 0 { latest, err := l.getLatestLedgerSequence(ctx); if err != nil { return startLedger, err }; return latest + 1, nil }
	cursor := ""; latestLedgerSeq := int32(0); var events []SorobanEvent
	for { params := GetEventsParams{StartLedger: startLedger, Filters: []EventFilter{{Type: "contract", ContractIDs: contractIDs}}, Pagination: &PaginationParams{Limit: 100, Cursor: cursor}}; var res GetEventsResult; if err := api.CallSorobanRPC(ctx, l.cfg.SorobanRPCURL, "getEvents", params, &res); err != nil { return startLedger, fmt.Errorf("call getEvents (startLedger=%d, cursor=%s): %w", startLedger, cursor, err) }; if res.LatestLedger != 0 { latestLedgerSeq = int32(res.LatestLedger) }; for _, ev := range res.Events { events = append(events, SorobanEvent{ID: ev.ID, ContractID: ev.ContractID, Ledger: ev.Ledger, LedgerClosedAt: ev.LedgerClosedAt, Topic: ev.Topic, Value: ev.Value.Xdr}) }; if res.Cursor != "" && len(res.Events) > 0 { cursor = res.Cursor } else { break } }
	ids := make([]string, 0, len(events)); for _, event := range events { ids = append(ids, event.ID) }
	processed, err := db.AreEventsProcessed(ctx, ids); if err != nil { return startLedger, fmt.Errorf("check processed events: %w", err) }
	for _, event := range events { if processed[event.ID] { continue }; if err := l.handleEvent(ctx, event); err != nil { return startLedger, fmt.Errorf("handle event %s: %w", event.ID, err) } }
	if latestLedgerSeq >= startLedger { return latestLedgerSeq + 1, nil }; return startLedger, nil
}
