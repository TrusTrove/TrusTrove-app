CREATE TABLE IF NOT EXISTS failed_events (
    event_id TEXT PRIMARY KEY,
    contract_id TEXT NOT NULL,
    ledger INTEGER NOT NULL,
    raw_topic JSONB NOT NULL,
    raw_value TEXT NOT NULL,
    error_text TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS failed_events_created_at_idx
    ON failed_events (created_at DESC);