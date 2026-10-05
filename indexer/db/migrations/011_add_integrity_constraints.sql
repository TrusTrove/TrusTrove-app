-- Enforce value domains that were previously only trusted to application and
-- contract code. Without these, drift (e.g. GetProtocolStats filtering on
-- lowercase statuses while the listener writes TitleCase ones) fails silently
-- instead of loudly.
--
-- Decision: a CHECK list is used instead of a Postgres enum for invoices.status.
-- The status set is expected to grow as the contract evolves, and adding a value
-- to a CHECK constraint is a simple ALTER TABLE ... DROP/ADD CONSTRAINT, whereas
-- enums require ALTER TYPE ... ADD VALUE (which historically could not run inside
-- a transaction block) and are awkward to remove values from.
--
-- Constraints are added NOT VALID then VALIDATE so that adding them does not
-- block startup on legacy rows; a cleanup UPDATE first brings existing data into
-- range so validation succeeds.

-- ── Cleanup legacy rows ──────────────────────────────────────────────────────

-- Normalize known lowercase variants from older listener versions, then coerce
-- anything still unrecognized to the initial state.
UPDATE invoices SET status = CASE lower(status)
        WHEN 'created'   THEN 'Created'
        WHEN 'listed'    THEN 'Listed'
        WHEN 'funded'    THEN 'Funded'
        WHEN 'shipped'   THEN 'Active'
        WHEN 'active'    THEN 'Active'
        WHEN 'confirmed' THEN 'Confirmed'
        WHEN 'repaid'    THEN 'Repaid'
        WHEN 'defaulted' THEN 'Defaulted'
        ELSE 'Created'
    END
    WHERE status NOT IN ('Created', 'Listed', 'Funded', 'Active', 'Confirmed', 'Repaid', 'Defaulted');

UPDATE invoices SET discount_bps = 0
    WHERE discount_bps < 0 OR discount_bps > 5000;

UPDATE invoices SET risk_score_bps = NULL
    WHERE risk_score_bps IS NOT NULL AND (risk_score_bps < 0 OR risk_score_bps > 10000);

UPDATE invoices SET face_value = 0
    WHERE face_value < 0;

UPDATE invoices SET funded_amount = face_value
    WHERE funded_amount > face_value;

UPDATE invoices SET funded_amount = 0
    WHERE funded_amount < 0;

-- pool_snapshots is a single-row table keyed by id = 1.
DELETE FROM pool_snapshots WHERE id <> 1;
UPDATE pool_snapshots SET utilization_rate_bps = 0
    WHERE utilization_rate_bps < 0 OR utilization_rate_bps > 10000;

UPDATE indexer_checkpoint SET value = 0 WHERE value < 0;

-- ── invoices ─────────────────────────────────────────────────────────────────

ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
    CHECK (status IN ('Created', 'Listed', 'Funded', 'Active', 'Confirmed', 'Repaid', 'Defaulted')) NOT VALID;
ALTER TABLE invoices VALIDATE CONSTRAINT invoices_status_check;

ALTER TABLE invoices ADD CONSTRAINT invoices_discount_bps_check
    CHECK (discount_bps >= 0 AND discount_bps <= 5000) NOT VALID;
ALTER TABLE invoices VALIDATE CONSTRAINT invoices_discount_bps_check;

ALTER TABLE invoices ADD CONSTRAINT invoices_risk_score_bps_check
    CHECK (risk_score_bps IS NULL OR (risk_score_bps >= 0 AND risk_score_bps <= 10000)) NOT VALID;
ALTER TABLE invoices VALIDATE CONSTRAINT invoices_risk_score_bps_check;

ALTER TABLE invoices ADD CONSTRAINT invoices_face_value_check
    CHECK (face_value >= 0) NOT VALID;
ALTER TABLE invoices VALIDATE CONSTRAINT invoices_face_value_check;

ALTER TABLE invoices ADD CONSTRAINT invoices_funded_amount_check
    CHECK (funded_amount >= 0 AND funded_amount <= face_value) NOT VALID;
ALTER TABLE invoices VALIDATE CONSTRAINT invoices_funded_amount_check;

-- ── pool_snapshots ───────────────────────────────────────────────────────────

ALTER TABLE pool_snapshots ADD CONSTRAINT pool_snapshots_single_row_check
    CHECK (id = 1) NOT VALID;
ALTER TABLE pool_snapshots VALIDATE CONSTRAINT pool_snapshots_single_row_check;

ALTER TABLE pool_snapshots ADD CONSTRAINT pool_snapshots_utilization_rate_bps_check
    CHECK (utilization_rate_bps >= 0 AND utilization_rate_bps <= 10000) NOT VALID;
ALTER TABLE pool_snapshots VALIDATE CONSTRAINT pool_snapshots_utilization_rate_bps_check;

-- ── indexer_checkpoint ───────────────────────────────────────────────────────

ALTER TABLE indexer_checkpoint ADD CONSTRAINT indexer_checkpoint_value_check
    CHECK (value >= 0) NOT VALID;
ALTER TABLE indexer_checkpoint VALIDATE CONSTRAINT indexer_checkpoint_value_check;
