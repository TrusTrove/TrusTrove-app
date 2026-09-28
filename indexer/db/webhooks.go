package db

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// WebhookSubscription represents a webhook subscription in the database.
type WebhookSubscription struct {
	ID            uuid.UUID `json:"id"`
	TargetURL     string    `json:"target_url"`
	EventTypes    []string  `json:"event_types"`
	SigningSecret string    `json:"signing_secret"`
	Active        bool      `json:"active"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// WebhookDelivery represents a webhook delivery attempt in the database.
type WebhookDelivery struct {
	ID             int64           `json:"id"`
	SubscriptionID uuid.UUID       `json:"subscription_id"`
	EventType      string          `json:"event_type"`
	EventID        string          `json:"event_id"`
	Payload        json.RawMessage `json:"payload"`
	Attempts       int             `json:"attempts"`
	MaxAttempts    int             `json:"max_attempts"`
	NextAttemptAt  time.Time       `json:"next_attempt_at"`
	LastStatus     *int            `json:"last_status"`
	LastResponse   *string         `json:"last_response"`
	LastError      *string         `json:"last_error"`
	Status         string          `json:"status"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
	EndpointURL    string          `json:"endpoint_url"`    // denormalized for worker convenience
	EndpointSecret string          `json:"endpoint_secret"` // denormalized for worker convenience
}

// CreateWebhookSubscription inserts a new webhook subscription.
func CreateWebhookSubscription(ctx context.Context, sub *WebhookSubscription) error {
	query := `
		INSERT INTO webhook_subscriptions (target_url, event_types, signing_secret, active)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at, updated_at
	`
	eventTypesArray := pgtype.Array[pgtype.Text]{
		Elements: make([]pgtype.Text, len(sub.EventTypes)),
		Dims:     []pgtype.ArrayDimension{{Length: int32(len(sub.EventTypes)), LowerBound: 1}},
	}
	for i, et := range sub.EventTypes {
		eventTypesArray.Elements[i] = pgtype.Text{String: et, Valid: true}
	}

	err := Pool.QueryRow(ctx, query, sub.TargetURL, eventTypesArray, sub.SigningSecret, sub.Active).Scan(
		&sub.ID, &sub.CreatedAt, &sub.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("db: create webhook subscription: %w", err)
	}
	return nil
}

// GetWebhookSubscriptionByID retrieves a webhook subscription by ID.
func GetWebhookSubscriptionByID(ctx context.Context, id uuid.UUID) (*WebhookSubscription, error) {
	query := `
		SELECT id, target_url, event_types, signing_secret, active, created_at, updated_at
		FROM webhook_subscriptions WHERE id = $1
	`
	var sub WebhookSubscription
	var eventTypesArray pgtype.Array[pgtype.Text]
	err := Pool.QueryRow(ctx, query, id).Scan(
		&sub.ID, &sub.TargetURL, &eventTypesArray, &sub.SigningSecret, &sub.Active, &sub.CreatedAt, &sub.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("db: get webhook subscription: %w", err)
	}
	sub.EventTypes = textArrayToSlice(eventTypesArray)
	return &sub, nil
}

// ListActiveWebhookSubscriptionsForEvent retrieves all active subscriptions for a given event type.
func ListActiveWebhookSubscriptionsForEvent(ctx context.Context, eventType string) ([]*WebhookSubscription, error) {
	query := `
		SELECT id, target_url, event_types, signing_secret, active, created_at, updated_at
		FROM webhook_subscriptions
		WHERE active = TRUE AND $1 = ANY(event_types)
	`
	rows, err := Pool.Query(ctx, query, eventType)
	if err != nil {
		return nil, fmt.Errorf("db: list webhook subscriptions: %w", err)
	}
	defer rows.Close()

	var subs []*WebhookSubscription
	for rows.Next() {
		var sub WebhookSubscription
		var eventTypesArray pgtype.Array[pgtype.Text]
		if err := rows.Scan(
			&sub.ID, &sub.TargetURL, &eventTypesArray, &sub.SigningSecret, &sub.Active, &sub.CreatedAt, &sub.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("db: scan webhook subscription: %w", err)
		}
		sub.EventTypes = textArrayToSlice(eventTypesArray)
		subs = append(subs, &sub)
	}
	return subs, nil
}

// ListAllWebhookSubscriptions retrieves all webhook subscriptions (for admin/management).
func ListAllWebhookSubscriptions(ctx context.Context) ([]*WebhookSubscription, error) {
	query := `
		SELECT id, target_url, event_types, signing_secret, active, created_at, updated_at
		FROM webhook_subscriptions
		ORDER BY created_at DESC
	`
	rows, err := Pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("db: list all webhook subscriptions: %w", err)
	}
	defer rows.Close()

	var subs []*WebhookSubscription
	for rows.Next() {
		var sub WebhookSubscription
		var eventTypesArray pgtype.Array[pgtype.Text]
		if err := rows.Scan(
			&sub.ID, &sub.TargetURL, &eventTypesArray, &sub.SigningSecret, &sub.Active, &sub.CreatedAt, &sub.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("db: scan webhook subscription: %w", err)
		}
		sub.EventTypes = textArrayToSlice(eventTypesArray)
		subs = append(subs, &sub)
	}
	return subs, nil
}

// UpdateWebhookSubscription updates a webhook subscription.
func UpdateWebhookSubscription(ctx context.Context, sub *WebhookSubscription) error {
	query := `
		UPDATE webhook_subscriptions
		SET target_url = $1, event_types = $2, signing_secret = $3, active = $4, updated_at = CURRENT_TIMESTAMP
		WHERE id = $5
		RETURNING updated_at
	`
	eventTypesArray := pgtype.Array[pgtype.Text]{
		Elements: make([]pgtype.Text, len(sub.EventTypes)),
		Dims:     []pgtype.ArrayDimension{{Length: int32(len(sub.EventTypes)), LowerBound: 1}},
	}
	for i, et := range sub.EventTypes {
		eventTypesArray.Elements[i] = pgtype.Text{String: et, Valid: true}
	}

	err := Pool.QueryRow(ctx, query, sub.TargetURL, eventTypesArray, sub.SigningSecret, sub.Active, sub.ID).Scan(&sub.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("db: update webhook subscription: not found")
		}
		return fmt.Errorf("db: update webhook subscription: %w", err)
	}
	return nil
}

// DeleteWebhookSubscription deletes a webhook subscription.
func DeleteWebhookSubscription(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM webhook_subscriptions WHERE id = $1`
	_, err := Pool.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("db: delete webhook subscription: %w", err)
	}
	return nil
}

// DisableWebhookSubscription marks a subscription as inactive.
func DisableWebhookSubscription(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE webhook_subscriptions SET active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1`
	_, err := Pool.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("db: disable webhook subscription: %w", err)
	}
	return nil
}

// CreateWebhookDelivery creates a new webhook delivery record.
func CreateWebhookDelivery(ctx context.Context, subscriptionID uuid.UUID, eventType, eventID string, payload []byte) error {
	query := `
		INSERT INTO webhook_deliveries (subscription_id, event_type, event_id, payload)
		VALUES ($1, $2, $3, $4)
	`
	_, err := Pool.Exec(ctx, query, subscriptionID, eventType, eventID, payload)
	if err != nil {
		return fmt.Errorf("db: create webhook delivery: %w", err)
	}
	return nil
}

// GetPendingDeliveries retrieves pending webhook deliveries ready for processing.
func GetPendingDeliveries(ctx context.Context, limit int) ([]*WebhookDelivery, error) {
	query := `
		SELECT
			wd.id, wd.subscription_id, wd.event_type, wd.event_id, wd.payload,
			wd.attempts, wd.max_attempts, wd.next_attempt_at, wd.last_status,
			wd.last_response, wd.last_error, wd.status, wd.created_at, wd.updated_at,
			ws.target_url, ws.signing_secret
		FROM webhook_deliveries wd
		JOIN webhook_subscriptions ws ON wd.subscription_id = ws.id
		WHERE wd.status = 'pending' AND wd.next_attempt_at <= CURRENT_TIMESTAMP AND ws.active = TRUE
		ORDER BY wd.next_attempt_at ASC
		LIMIT $1
	`
	rows, err := Pool.Query(ctx, query, limit)
	if err != nil {
		return nil, fmt.Errorf("db: get pending deliveries: %w", err)
	}
	defer rows.Close()

	var deliveries []*WebhookDelivery
	for rows.Next() {
		var d WebhookDelivery
		if err := rows.Scan(
			&d.ID, &d.SubscriptionID, &d.EventType, &d.EventID, &d.Payload,
			&d.Attempts, &d.MaxAttempts, &d.NextAttemptAt, &d.LastStatus,
			&d.LastResponse, &d.LastError, &d.Status, &d.CreatedAt, &d.UpdatedAt,
			&d.EndpointURL, &d.EndpointSecret,
		); err != nil {
			return nil, fmt.Errorf("db: scan webhook delivery: %w", err)
		}
		deliveries = append(deliveries, &d)
	}
	return deliveries, nil
}

// MarkDeliverySuccess marks a webhook delivery as successful.
func MarkDeliverySuccess(ctx context.Context, deliveryID int64, statusCode int, response string) error {
	query := `
		UPDATE webhook_deliveries
		SET status = 'delivered', last_status = $1, last_response = $2, last_error = NULL,
		    attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP
		WHERE id = $3
	`
	_, err := Pool.Exec(ctx, query, statusCode, response, deliveryID)
	if err != nil {
		return fmt.Errorf("db: mark delivery success: %w", err)
	}
	return nil
}

// MarkDeliveryRetry marks a webhook delivery as failed and schedules a retry.
// If attempts + 1 >= max_attempts, the delivery is marked as dead_letter instead.
func MarkDeliveryRetry(ctx context.Context, deliveryID int64, nextAttemptAt time.Time, statusCode *int, errorMsg string) error {
	query := `
		UPDATE webhook_deliveries
		SET status = CASE
				WHEN attempts + 1 >= max_attempts THEN 'dead_letter'
				ELSE 'pending'
			END,
			last_status = $1,
			last_error = $2,
			next_attempt_at = CASE
				WHEN attempts + 1 >= max_attempts THEN next_attempt_at
				ELSE $3
			END,
			attempts = attempts + 1,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = $4
	`
	_, err := Pool.Exec(ctx, query, statusCode, errorMsg, nextAttemptAt, deliveryID)
	if err != nil {
		return fmt.Errorf("db: mark delivery retry: %w", err)
	}
	return nil
}

// MarkDeliveryDeadLetter marks a webhook delivery as dead-lettered (exhausted retries).
func MarkDeliveryDeadLetter(ctx context.Context, deliveryID int64, errorMsg string) error {
	query := `
		UPDATE webhook_deliveries
		SET status = 'dead_letter', last_error = $1, updated_at = CURRENT_TIMESTAMP
		WHERE id = $2
	`
	_, err := Pool.Exec(ctx, query, errorMsg, deliveryID)
	if err != nil {
		return fmt.Errorf("db: mark delivery dead letter: %w", err)
	}
	return nil
}

// textArrayToSlice converts a pgtype.Array[pgtype.Text] to a Go string slice.
func textArrayToSlice(arr pgtype.Array[pgtype.Text]) []string {
	dims := arr.Dimensions()
	if dims == nil || len(dims) == 0 || dims[0].Length == 0 {
		return []string{}
	}
	result := make([]string, 0, dims[0].Length)
	for _, elem := range arr.Elements {
		if elem.Valid {
			result = append(result, elem.String)
		}
	}
	return result
}
