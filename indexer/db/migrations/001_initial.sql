CREATE TABLE IF NOT EXISTS invoices (
    id VARCHAR(64) PRIMARY KEY,
    issuer VARCHAR(56) NOT NULL,
    buyer VARCHAR(56) NOT NULL,
    face_value NUMERIC NOT NULL,
    discount_bps INTEGER NOT NULL,
    funded_amount NUMERIC NOT NULL DEFAULT 0,
    due_date BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at BIGINT NOT NULL,
    funded_at BIGINT,
    shipped_at BIGINT,
    issuer_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    buyer_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    repaid_at BIGINT
);

CREATE TABLE IF NOT EXISTS pool_snapshots (
    id INTEGER PRIMARY KEY,
    total_deposits NUMERIC NOT NULL DEFAULT 0,
    total_funded NUMERIC NOT NULL DEFAULT 0,
    available_liquidity NUMERIC NOT NULL DEFAULT 0,
    utilization_rate_bps INTEGER NOT NULL DEFAULT 0,
    total_yield_distributed NUMERIC NOT NULL DEFAULT 0,
    active_invoice_count INTEGER NOT NULL DEFAULT 0,
    total_shares NUMERIC NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO pool_snapshots (id, total_deposits, total_funded, available_liquidity, utilization_rate_bps, total_yield_distributed, active_invoice_count, total_shares)
VALUES (1, 0, 0, 0, 0, 0, 0, 0)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS events_log (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(128) UNIQUE NOT NULL,
    contract_id VARCHAR(56) NOT NULL,
    ledger INTEGER NOT NULL,
    ledger_closed_at BIGINT NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    data JSONB NOT NULL
);
