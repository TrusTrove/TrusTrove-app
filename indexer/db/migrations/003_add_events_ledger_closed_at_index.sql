-- Supports the chronological event history query in db/queries.go:
-- ORDER BY ledger_closed_at DESC.
CREATE INDEX IF NOT EXISTS idx_events_log_ledger_closed_at
    ON events_log (ledger_closed_at);
