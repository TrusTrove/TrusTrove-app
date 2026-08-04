-- Supports queries filtering/joining on events_log.ledger in db/queries.go.
CREATE INDEX IF NOT EXISTS idx_events_log_ledger ON events_log (ledger);
