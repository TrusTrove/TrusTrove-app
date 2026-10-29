CREATE TABLE IF NOT EXISTS failed_events (
    id BIGSERIAL PRIMARY KEY,
    event_id VARCHAR(128),
    contract_id VARCHAR(56) NOT NULL,
    ledger INTEGER NOT NULL,
    raw_topic JSONB NOT NULL,
    raw_value TEXT NOT NULL,
    error_text TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_failed_events_event_id
    ON failed_events (event_id)
    WHERE event_id IS NOT NULL;