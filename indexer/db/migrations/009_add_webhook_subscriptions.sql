-- Migration 009: Add webhook_subscriptions table for webhook event delivery
-- This migration creates the subscription table and supporting indexes

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_url      TEXT NOT NULL,
    event_types     TEXT[] NOT NULL DEFAULT '{}',
    signing_secret  TEXT NOT NULL,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient "who is subscribed to X" lookups by the delivery worker
CREATE INDEX IF NOT EXISTS webhook_subscriptions_event_types_idx
    ON webhook_subscriptions USING GIN (event_types);

-- Index for filtering active subscriptions
CREATE INDEX IF NOT EXISTS webhook_subscriptions_active_idx
    ON webhook_subscriptions (active)
    WHERE active = TRUE;

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_webhook_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_webhook_subscriptions_updated_at ON webhook_subscriptions;
CREATE TRIGGER trigger_webhook_subscriptions_updated_at
    BEFORE UPDATE ON webhook_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_webhook_subscriptions_updated_at();

-- Webhook deliveries table for tracking delivery attempts (used by worker)
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id              BIGSERIAL PRIMARY KEY,
    subscription_id UUID NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
    event_type      TEXT NOT NULL,
    event_id        TEXT NOT NULL,
    payload         JSONB NOT NULL,
    attempts        INTEGER NOT NULL DEFAULT 0,
    max_attempts    INTEGER NOT NULL DEFAULT 5,
    next_attempt_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_status     INTEGER,
    last_response   TEXT,
    last_error      TEXT,
    status          TEXT NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient polling of pending deliveries
CREATE INDEX IF NOT EXISTS webhook_deliveries_pending_idx
    ON webhook_deliveries (next_attempt_at)
    WHERE status = 'pending';

-- Index for querying deliveries by subscription
CREATE INDEX IF NOT EXISTS webhook_deliveries_subscription_idx
    ON webhook_deliveries (subscription_id);

-- Trigger to auto-update updated_at timestamp for deliveries
CREATE OR REPLACE FUNCTION update_webhook_deliveries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_webhook_deliveries_updated_at ON webhook_deliveries;
CREATE TRIGGER trigger_webhook_deliveries_updated_at
    BEFORE UPDATE ON webhook_deliveries
    FOR EACH ROW
    EXECUTE FUNCTION update_webhook_deliveries_updated_at();