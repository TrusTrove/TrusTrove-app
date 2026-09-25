-- Clear existing data
TRUNCATE TABLE events_log CASCADE;
TRUNCATE TABLE invoices CASCADE;

-- Update pool snapshots
UPDATE pool_snapshots 
SET total_deposits = 1000000000, 
    total_funded = 500000000, 
    available_liquidity = 500000000, 
    utilization_rate_bps = 5000, 
    total_yield_distributed = 25000000, 
    active_invoice_count = 2, 
    total_shares = 1000000000
WHERE id = 1;

-- Insert some dummy invoices
INSERT INTO invoices (id, issuer, buyer, face_value, discount_bps, funded_amount, due_date, status, created_at)
VALUES 
('inv_001', 'GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', 'GCXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', 1000000, 500, 1000000, 1750000000, 'FUNDED', 1700000000),
('inv_002', 'GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', 'GCXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', 2000000, 400, 0, 1760000000, 'PENDING', 1700000000);

-- Insert dummy events
INSERT INTO events_log (event_id, contract_id, ledger, ledger_closed_at, event_type, data)
VALUES 
('evt_001', 'CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', 1000, 1700000000, 'INVOICE_CREATED', '{"invoice_id": "inv_001"}'),
('evt_002', 'CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', 1001, 1700000000, 'INVOICE_CREATED', '{"invoice_id": "inv_002"}');
