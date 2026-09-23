CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id SERIAL PRIMARY KEY,
    user_address VARCHAR(56) NOT NULL,
    url TEXT NOT NULL,
    secret VARCHAR(64) NOT NULL,
    event_types VARCHAR(50)[] NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_user ON webhook_subscriptions(user_address);
