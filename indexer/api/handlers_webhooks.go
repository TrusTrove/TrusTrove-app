package api

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"trusttrove/indexer/db"
)

type WebhookSubscription struct {
	ID          int       `json:"id"`
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

func generateSecret() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

func isSafeURL(urlString string) bool {
	u, err := url.ParseRequestURI(urlString)
	if err != nil {
		return false
	}

	if u.Scheme != "http" && u.Scheme != "https" {
		return false
	}

	host := u.Hostname()
	if host == "" {
		return false
	}

	ips, err := net.LookupIP(host)
	if err != nil {
		ip := net.ParseIP(host)
		if ip == nil {
			return false
		}
		ips = []net.IP{ip}
	}

	for _, ip := range ips {
		if ip.IsPrivate() || ip.IsLoopback() || ip.IsUnspecified() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() {
			return false
		}
	}

	return true
}

// Database access functions are isolated in variables to allow mocking in tests.
var createWebhookSub = func(ctx context.Context, userAddr, u, secret string, eventTypes []string) (WebhookSubscription, error) {
	var sub WebhookSubscription
	err := db.Pool.QueryRow(ctx, `
		INSERT INTO webhook_subscriptions (user_address, url, secret, event_types)
		VALUES ($1, $2, $3, $4)
		RETURNING id, user_address, url, secret, event_types, created_at
	`, userAddr, u, secret, eventTypes).Scan(&sub.ID, &sub.UserAddress, &sub.URL, &sub.Secret, &sub.EventTypes, &sub.CreatedAt)
	return sub, err
}

var getWebhookSubs = func(ctx context.Context, userAddr string) ([]WebhookSubscription, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT id, user_address, url, event_types, created_at
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

var deleteWebhookSub = func(ctx context.Context, id int, userAddr string) (int64, error) {
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON body", http.StatusBadRequest)
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
		http.Error(w, "failed to generate secret", http.StatusInternalServerError)
		return
	}

	sub, err := createWebhookSub(r.Context(), userAddr, req.URL, secret, req.EventTypes)
	if err != nil {
		http.Error(w, "failed to create webhook subscription", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(sub)
}

func (h *APIHandler) HandleGetWebhooks(w http.ResponseWriter, r *http.Request) {
	userAddr, ok := GetUserAddress(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	subs, err := getWebhookSubs(r.Context(), userAddr)
	if err != nil {
		http.Error(w, "failed to query webhooks", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data": subs,
	})
}

func (h *APIHandler) HandleDeleteWebhook(w http.ResponseWriter, r *http.Request) {
	userAddr, ok := GetUserAddress(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	affected, err := deleteWebhookSub(r.Context(), id, userAddr)
	if err != nil {
		http.Error(w, "failed to delete webhook", http.StatusInternalServerError)
		return
	}

	if affected == 0 {
		http.Error(w, "webhook not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
