CREATE TABLE IF NOT EXISTS indexer_checkpoint (
    key VARCHAR(64) PRIMARY KEY,
    value INTEGER NOT NULL
);

INSERT INTO indexer_checkpoint (key, value)
VALUES ('latest_processed_ledger', 0)
ON CONFLICT (key) DO NOTHING;
