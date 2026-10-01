-- Migration 010: Add row-level claiming to the webhook delivery queue
--
-- webhook_deliveries rows were read with a plain SELECT, so two indexer
-- replicas (or an old and a new pod during a rolling deploy) could pick up the
-- same pending row and POST the event twice. `locked_until` records how long a
-- worker has claimed a row; the Mark* helpers release the claim as soon as an
-- attempt finishes, and it expires on its own if the worker dies mid-send, so
-- the queue stays at-least-once instead of getting stuck.
ALTER TABLE webhook_deliveries
    ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;

COMMENT ON COLUMN webhook_deliveries.locked_until IS
    'Claim deadline for the worker currently attempting this delivery; NULL means unclaimed.';

-- No new index: webhook_deliveries_pending_idx on (next_attempt_at)
-- WHERE status = 'pending' remains the access path for claims, and locked_until
-- is compared against CURRENT_TIMESTAMP, which is not immutable and therefore
-- cannot appear in a partial index predicate.
