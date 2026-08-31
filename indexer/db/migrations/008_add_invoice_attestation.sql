-- Add attestation columns to invoices table.
-- These are nullable because most invoices will not have an attestation yet.
ALTER TABLE invoices ADD COLUMN attestation_agent_id VARCHAR;
ALTER TABLE invoices ADD COLUMN risk_score_bps INTEGER;
ALTER TABLE invoices ADD COLUMN evidence_hash VARCHAR(64);
ALTER TABLE invoices ADD COLUMN attested_at BIGINT;
