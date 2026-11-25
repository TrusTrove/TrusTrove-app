-- Keep the most advanced existing delivery when cleaning duplicates, so a
-- previously delivered event is not returned to the queue.
WITH ranked_deliveries AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY subscription_id, event_id
               ORDER BY CASE status
                            WHEN 'delivered' THEN 0
                            WHEN 'dead_letter' THEN 1
                            ELSE 2
                        END,
                        attempts DESC,
                        id
           ) AS duplicate_number
    FROM webhook_deliveries
)
DELETE FROM webhook_deliveries
USING ranked_deliveries
WHERE webhook_deliveries.id = ranked_deliveries.id
    AND ranked_deliveries.duplicate_number > 1;

ALTER TABLE webhook_deliveries
    ADD CONSTRAINT webhook_deliveries_subscription_event_unique
    UNIQUE (subscription_id, event_id);
