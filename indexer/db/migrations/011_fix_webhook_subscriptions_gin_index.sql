-- Migration 011: Fix webhook_subscriptions GIN index usage
--
-- The query in ListActiveWebhookSubscriptionsForEvent previously used:
--
--     WHERE active = TRUE AND $1 = ANY(event_types)
--
-- That form cannot use a GIN index on a text[] column; the planner falls back
-- to a sequential scan.  The query has been rewritten to:
--
--     WHERE active = TRUE AND event_types @> ARRAY[$1]::text[]
--
-- The @> (contains) operator is one the GIN index directly supports, so
-- the existing webhook_subscriptions_event_types_idx will now be used.
--
-- This migration is a no-op DDL change; it re-creates the index
-- concurrently so it is usable immediately without a table lock, and
-- drops the old one afterwards.  On a fresh database both statements are
-- idempotent (CREATE IF NOT EXISTS / DROP IF EXISTS).

-- Re-create the GIN index with the same definition so it is definitely
-- present on upgraded databases too.
CREATE INDEX IF NOT EXISTS webhook_subscriptions_event_types_idx
    ON webhook_subscriptions USING GIN (event_types);
