CREATE TABLE IF NOT EXISTS pool_snapshot_history (
    id BIGSERIAL PRIMARY KEY,
    recorded_at BIGINT NOT NULL,
    total_deposits NUMERIC NOT NULL DEFAULT 0,
    total_funded NUMERIC NOT NULL DEFAULT 0,
    available_liquidity NUMERIC NOT NULL DEFAULT 0,
    utilization_rate_bps INTEGER NOT NULL DEFAULT 0,
    total_yield_distributed NUMERIC NOT NULL DEFAULT 0,
    active_invoice_count INTEGER NOT NULL DEFAULT 0,
    total_shares NUMERIC NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_pool_snapshot_history_recorded_at
    ON pool_snapshot_history (recorded_at);
