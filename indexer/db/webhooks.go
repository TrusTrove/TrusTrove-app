package db

import (
	"context"
	"fmt"
	"time"
)

type WebhookEndpoint struct {
	ID         int64
	URL        string
	Secret     string
	EventTypes []string
}

type WebhookDelivery struct {
	ID             int64
	EndpointID     int64
	EndpointURL    string
	EndpointSecret string
	EventType      string
	Payload        []byte
	Attempts       int
	MaxAttempts    int
}

// ListActiveWebhookEndpointsForEvent returns endpoints that subscribe to eventType.
// An endpoint with an empty event_types array receives every event type.
func ListActiveWebhookEndpointsForEvent(ctx context.Context, eventType string) ([]*WebhookEndpoint, error) {
	rows, err := Pool.Query(ctx, `
		SELECT id, url, secret, event_types
		FROM webhook_endpoints
		WHERE active = TRUE
		  AND (cardinality(event_types) = 0 OR $1 = ANY(event_types))
	`, eventType)
	if err != nil {
		return nil, fmt.Errorf("db: list webhook endpoints: %w", err)
	}
	defer rows.Close()

	var endpoints []*WebhookEndpoint
	for rows.Next() {
		var ep WebhookEndpoint
		if err := rows.Scan(&ep.ID, &ep.URL, &ep.Secret, &ep.EventTypes); err != nil {
			return nil, fmt.Errorf("db: scan webhook endpoint: %w", err)
		}
		endpoints = append(endpoints, &ep)
	}
	return endpoints, rows.Err()
}

// CreateWebhookDelivery enqueues a delivery for one endpoint.
func CreateWebhookDelivery(ctx context.Context, endpointID int64, eventType string, payload []byte) error {
	_, err := Pool.Exec(ctx, `
		INSERT INTO webhook_deliveries (endpoint_id, event_type, payload)
		VALUES ($1, $2, $3)
	`, endpointID, eventType, payload)
	if err != nil {
		return fmt.Errorf("db: create webhook delivery: %w", err)
	}
	return nil
}

// GetPendingDeliveries returns up to limit overdue deliveries ready to attempt.
func GetPendingDeliveries(ctx context.Context, limit int) ([]*WebhookDelivery, error) {
	rows, err := Pool.Query(ctx, `
		SELECT d.id, d.endpoint_id, e.url, e.secret, d.event_type, d.payload, d.attempts, d.max_attempts
		FROM webhook_deliveries d
		JOIN webhook_endpoints e ON e.id = d.endpoint_id
		WHERE d.status = 'pending'
		  AND d.next_attempt_at <= NOW()
		ORDER BY d.next_attempt_at ASC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, fmt.Errorf("db: get pending deliveries: %w", err)
	}
	defer rows.Close()

	var deliveries []*WebhookDelivery
	for rows.Next() {
		var d WebhookDelivery
		if err := rows.Scan(
			&d.ID, &d.EndpointID, &d.EndpointURL, &d.EndpointSecret,
			&d.EventType, &d.Payload, &d.Attempts, &d.MaxAttempts,
		); err != nil {
			return nil, fmt.Errorf("db: scan webhook delivery: %w", err)
		}
		deliveries = append(deliveries, &d)
	}
	return deliveries, rows.Err()
}

// MarkDeliverySuccess records a successful HTTP delivery.
func MarkDeliverySuccess(ctx context.Context, id int64, statusCode int, responseBody string) error {
	_, err := Pool.Exec(ctx, `
		UPDATE webhook_deliveries
		SET status = 'delivered',
		    attempts = attempts + 1,
		    last_status = $2,
		    last_response = $3,
		    updated_at = NOW()
		WHERE id = $1
	`, id, statusCode, responseBody)
	return err
}

// MarkDeliveryRetry schedules the next retry attempt.
func MarkDeliveryRetry(ctx context.Context, id int64, nextAttemptAt time.Time, statusCode *int, errMsg string) error {
	_, err := Pool.Exec(ctx, `
		UPDATE webhook_deliveries
		SET attempts = attempts + 1,
		    next_attempt_at = $2,
		    last_status = $3,
		    last_error = $4,
		    updated_at = NOW()
		WHERE id = $1
	`, id, nextAttemptAt, statusCode, errMsg)
	return err
}

// MarkDeliveryDeadLetter moves a delivery to the dead-letter state after all retries fail.
func MarkDeliveryDeadLetter(ctx context.Context, id int64, errMsg string) error {
	_, err := Pool.Exec(ctx, `
		UPDATE webhook_deliveries
		SET status = 'dead_letter',
		    attempts = attempts + 1,
		    last_error = $2,
		    updated_at = NOW()
		WHERE id = $1
	`, id, errMsg)
	return err
}
