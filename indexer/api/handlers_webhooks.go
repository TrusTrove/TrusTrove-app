package api

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"trusttrove/indexer/db"
	"trusttrove/indexer/netguard"
)

const (
	defaultWebhookDeliveryLimit = 20
	maxWebhookDeliveryLimit     = 100
)

type WebhookSubscription struct {
	ID          uuid.UUID `json:"id"`
	UserAddress string    `json:"user_address"`
	URL         string    `json:"url"`
	Secret      string    `json:"secret,omitempty"`
	EventTypes  []string  `json:"event_types"`
	CreatedAt   time.Time `json:"created_at"`
}

type CreateWebhookRequest struct {
	URL        string   `json:"url"`
	EventTypes []string `json:"event_types"`
}

// WebhookDeliveryAttempt is the redacted, owner-visible view of a delivery
// row. It deliberately omits the target URL, signing secret, and payload:
// delivery inspection needs outcome and timing, not destination credentials.
type WebhookDeliveryAttempt struct {
	ID             int64     `json:"id"`
	SubscriptionID uuid.UUID `json:"subscription_id"`
	EventType      string    `json:"event_type"`
	EventID        string    `json:"event_id"`
	Status         string    `json:"status"`
	Attempts       int       `json:"attempts"`
	MaxAttempts    int       `json:"max_attempts"`
	NextAttemptAt  time.Time `json:"next_attempt_at"`
	LastStatus     *int      `json:"last_status"`
	LastError      *string   `json:"last_error"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

func generateSecret() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// isSafeURL validates a subscription target at creation time. The delivery
// worker re-runs the same guard on every request and redirect because a host
// can resolve differently later (#1076).
func isSafeURL(urlString string) bool {
	return netguard.IsSafeURL(urlString)
}

// Database access functions are isolated in variables to allow mocking in tests.
var createWebhookSub = func(ctx context.Context, userAddr, u, secret string, eventTypes []string) (WebhookSubscription, error) {
	var sub WebhookSubscription
	err := db.Pool.QueryRow(ctx, `
		INSERT INTO webhook_subscriptions (user_address, target_url, signing_secret, event_types)
		VALUES ($1, $2, $3, $4)
		RETURNING id, user_address, target_url, signing_secret, event_types, created_at
	`, userAddr, u, secret, eventTypes).Scan(&sub.ID, &sub.UserAddress, &sub.URL, &sub.Secret, &sub.EventTypes, &sub.CreatedAt)
	return sub, err
}

var getWebhookSubs = func(ctx context.Context, userAddr string) ([]WebhookSubscription, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT id, user_address, target_url, event_types, created_at
		FROM webhook_subscriptions
		WHERE user_address = $1
		ORDER BY created_at DESC
	`, userAddr)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	subs := []WebhookSubscription{}
	for rows.Next() {
		var sub WebhookSubscription
		if err := rows.Scan(&sub.ID, &sub.UserAddress, &sub.URL, &sub.EventTypes, &sub.CreatedAt); err != nil {
			return nil, err
		}
		subs = append(subs, sub)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return subs, nil
}

// getWebhookDeliveryAttempts returns one subscription's deliveries newest
// first. The boolean is false when the subscription does not exist or belongs
// to another user, which lets the handler answer 404 without revealing whether
// the ID exists. The join on user_address enforces ownership in the query
// itself, not only in the existence check.
var getWebhookDeliveryAttempts = func(ctx context.Context, id uuid.UUID, userAddr string, limit int) ([]WebhookDeliveryAttempt, bool, error) {
	var exists bool
	if err := db.Pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM webhook_subscriptions
			WHERE id = $1 AND user_address = $2
		)
	`, id, userAddr).Scan(&exists); err != nil {
		return nil, false, err
	}
	if !exists {
		return nil, false, nil
	}

	rows, err := db.Pool.Query(ctx, `
		SELECT wd.id, wd.subscription_id, wd.event_type, wd.event_id,
		       wd.status, wd.attempts, wd.max_attempts, wd.next_attempt_at,
		       wd.last_status, wd.last_error, wd.created_at, wd.updated_at
		FROM webhook_deliveries wd
		JOIN webhook_subscriptions ws ON ws.id = wd.subscription_id
		WHERE wd.subscription_id = $1 AND ws.user_address = $2
		ORDER BY wd.created_at DESC, wd.id DESC
		LIMIT $3
	`, id, userAddr, limit)
	if err != nil {
		return nil, true, err
	}
	defer rows.Close()

	attempts := []WebhookDeliveryAttempt{}
	for rows.Next() {
		var attempt WebhookDeliveryAttempt
		if err := rows.Scan(
			&attempt.ID, &attempt.SubscriptionID, &attempt.EventType,
			&attempt.EventID, &attempt.Status, &attempt.Attempts,
			&attempt.MaxAttempts, &attempt.NextAttemptAt,
			&attempt.LastStatus, &attempt.LastError,
			&attempt.CreatedAt, &attempt.UpdatedAt,
		); err != nil {
			return nil, true, err
		}
		attempts = append(attempts, attempt)
	}
	if err := rows.Err(); err != nil {
		return nil, true, err
	}
	return attempts, true, nil
}

var deleteWebhookSub = func(ctx context.Context, id uuid.UUID, userAddr string) (int64, error) {
	cmd, err := db.Pool.Exec(ctx, `
		DELETE FROM webhook_subscriptions
		WHERE id = $1 AND user_address = $2
	`, id, userAddr)
	if err != nil {
		return 0, err
	}
	return cmd.RowsAffected(), nil
}

func (h *APIHandler) HandleCreateWebhook(w http.ResponseWriter, r *http.Request) {
	userAddr, ok := GetUserAddress(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req CreateWebhookRequest
	if !decodeJSONBody(w, r, &req, maxCreateWebhookBodyBytes) {
		return
	}

	if req.URL == "" {
		http.Error(w, "url is required", http.StatusBadRequest)
		return
	}
	if len(req.EventTypes) == 0 {
		http.Error(w, "event_types is required", http.StatusBadRequest)
		return
	}

	if !isSafeURL(req.URL) {
		http.Error(w, "invalid or unsafe url", http.StatusBadRequest)
		return
	}

	secret, err := generateSecret()
	if err != nil {
		internalError(w, r, "failed to generate secret", err)
		return
	}

	sub, err := createWebhookSub(r.Context(), userAddr, req.URL, secret, req.EventTypes)
	if err != nil {
		internalError(w, r, "failed to create webhook subscription", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(sub)
}

func (h *APIHandler) HandleGetWebhooks(w http.ResponseWriter, r *http.Request) {
	userAddr, ok := GetUserAddress(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	subs, err := getWebhookSubs(r.Context(), userAddr)
	if err != nil {
		internalError(w, r, "failed to query webhooks", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"data": subs,
	})
}

func (h *APIHandler) HandleGetWebhookDeliveries(w http.ResponseWriter, r *http.Request) {
	userAddr, ok := GetUserAddress(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	limit := defaultWebhookDeliveryLimit
	if raw := r.URL.Query().Get("limit"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 1 || parsed > maxWebhookDeliveryLimit {
			http.Error(w, "invalid limit", http.StatusBadRequest)
			return
		}
		limit = parsed
	}

	attempts, found, err := getWebhookDeliveryAttempts(r.Context(), id, userAddr, limit)
	if err != nil {
		http.Error(w, "failed to query webhook deliveries", http.StatusInternalServerError)
		return
	}
	if !found {
		http.Error(w, "webhook not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"data": attempts,
	})
}

func (h *APIHandler) HandleDeleteWebhook(w http.ResponseWriter, r *http.Request) {
	userAddr, ok := GetUserAddress(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	affected, err := deleteWebhookSub(r.Context(), id, userAddr)
	if err != nil {
		internalError(w, r, "failed to delete webhook", err)
		return
	}

	if affected == 0 {
		http.Error(w, "webhook not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
