package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func TestHandleCreateWebhook(t *testing.T) {
	h := newTestHandler(t)

	// Mock DB function
	origCreate := createWebhookSub
	defer func() { createWebhookSub = origCreate }()
	createWebhookSub = func(ctx context.Context, userAddr, u, secret string, eventTypes []string) (WebhookSubscription, error) {
		return WebhookSubscription{
			ID:          uuid.MustParse("00000000-0000-0000-0000-000000000001"),
			UserAddress: userAddr,
			URL:         u,
			Secret:      secret,
			EventTypes:  eventTypes,
			CreatedAt:   time.Now(),
		}, nil
	}

	tests := []struct {
		name       string
		body       string
		withAddr   bool
		wantStatus int
	}{
		{"missing address", `{"url":"https://example.com","event_types":["all"]}`, false, http.StatusUnauthorized},
		{"invalid json", `{url:bad}`, true, http.StatusBadRequest},
		{"unknown field", `{"url":"https://example.com/webhook","event_types":["all"],"extra":"x"}`, true, http.StatusBadRequest},
		{"missing url", `{"event_types":["all"]}`, true, http.StatusBadRequest},
		{"missing event_types", `{"url":"https://example.com"}`, true, http.StatusBadRequest},
		{"unsafe url - localhost", `{"url":"http://127.0.0.1/test","event_types":["all"]}`, true, http.StatusBadRequest},
		{"unsafe url - private ip", `{"url":"http://10.0.0.1/test","event_types":["all"]}`, true, http.StatusBadRequest},
		{"unsafe url - wrong scheme", `{"url":"ftp://example.com/test","event_types":["all"]}`, true, http.StatusBadRequest},
		{"valid url", `{"url":"https://example.com/webhook","event_types":["all"]}`, true, http.StatusCreated},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/webhooks", bytes.NewBufferString(tt.body))
			req.Header.Set("Content-Type", "application/json")
			if tt.withAddr {
				req = req.WithContext(WithUserAddress(req.Context(), "GADDR..."))
			}

			w := httptest.NewRecorder()
			h.HandleCreateWebhook(w, req)

			if w.Code != tt.wantStatus {
				t.Errorf("got %d, want %d", w.Code, tt.wantStatus)
			}
		})
	}
}

func TestHandleCreateWebhook_OversizedBody(t *testing.T) {
	h := newTestHandler(t)

	body := `{"url":"https://example.com/webhook","event_types":["all"],"padding":"` +
		strings.Repeat("A", int(maxCreateWebhookBodyBytes)) + `"}`
	req := httptest.NewRequest(http.MethodPost, "/webhooks", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = req.WithContext(WithUserAddress(req.Context(), "GADDR..."))

	w := httptest.NewRecorder()
	h.HandleCreateWebhook(w, req)

	if w.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("oversized body: got %d, want %d", w.Code, http.StatusRequestEntityTooLarge)
	}
}

func TestHandleGetWebhooks(t *testing.T) {
	h := newTestHandler(t)

	// Mock DB function
	origGet := getWebhookSubs
	defer func() { getWebhookSubs = origGet }()
	getWebhookSubs = func(ctx context.Context, userAddr string) ([]WebhookSubscription, error) {
		return []WebhookSubscription{
			{
				ID:          uuid.MustParse("00000000-0000-0000-0000-000000000001"),
				UserAddress: userAddr,
				URL:         "https://example.com",
				EventTypes:  []string{"all"},
			},
		}, nil
	}

	req := httptest.NewRequest(http.MethodGet, "/webhooks", nil)
	req = req.WithContext(WithUserAddress(req.Context(), "GADDR..."))

	w := httptest.NewRecorder()
	h.HandleGetWebhooks(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("got %d, want %d", w.Code, http.StatusOK)
	}

	var resp map[string][]WebhookSubscription
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(resp["data"]) != 1 {
		t.Errorf("expected 1 webhook, got %d", len(resp["data"]))
	}
}

func TestHandleGetWebhookDeliveries(t *testing.T) {
	h := newTestHandler(t)

	origGet := getWebhookDeliveryAttempts
	defer func() { getWebhookDeliveryAttempts = origGet }()

	targetID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	lastStatus := 500
	lastError := "non-2xx response: 500"
	nextAttempt := time.Date(2026, time.November, 24, 12, 0, 0, 0, time.UTC)
	getWebhookDeliveryAttempts = func(ctx context.Context, id uuid.UUID, userAddr string, limit int) ([]WebhookDeliveryAttempt, bool, error) {
		if id != targetID {
			return nil, false, nil
		}
		return []WebhookDeliveryAttempt{
			{
				ID:             7,
				SubscriptionID: id,
				EventType:      "invoice.funded",
				EventID:        "0021255638529081344-0000000001",
				Status:         "pending",
				Attempts:       2,
				MaxAttempts:    5,
				NextAttemptAt:  nextAttempt,
				LastStatus:     &lastStatus,
				LastError:      &lastError,
				CreatedAt:      nextAttempt.Add(-time.Hour),
				UpdatedAt:      nextAttempt.Add(-time.Minute),
			},
		}, true, nil
	}

	tests := []struct {
		name       string
		id         string
		query      string
		withAddr   bool
		wantStatus int
	}{
		{"missing address", targetID.String(), "", false, http.StatusUnauthorized},
		{"invalid id", "abc", "", true, http.StatusBadRequest},
		{"invalid limit", targetID.String(), "?limit=0", true, http.StatusBadRequest},
		{"limit too large", targetID.String(), "?limit=101", true, http.StatusBadRequest},
		{"not found", "00000000-0000-0000-0000-000000000099", "", true, http.StatusNotFound},
		{"empty list", targetID.String(), "?limit=5", true, http.StatusOK},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/webhooks/"+tt.id+"/deliveries"+tt.query, nil)
			if tt.withAddr {
				req = req.WithContext(WithUserAddress(req.Context(), "GADDR..."))
			}
			rctx := chi.NewRouteContext()
			rctx.URLParams.Add("id", tt.id)
			req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

			w := httptest.NewRecorder()
			h.HandleGetWebhookDeliveries(w, req)

			if w.Code != tt.wantStatus {
				t.Fatalf("got %d, want %d (body %q)", w.Code, tt.wantStatus, w.Body.String())
			}
		})
	}
}

func TestHandleGetWebhookDeliveries_RedactsDestinationSecrets(t *testing.T) {
	h := newTestHandler(t)

	origGet := getWebhookDeliveryAttempts
	defer func() { getWebhookDeliveryAttempts = origGet }()
	id := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	getWebhookDeliveryAttempts = func(ctx context.Context, gotID uuid.UUID, userAddr string, limit int) ([]WebhookDeliveryAttempt, bool, error) {
		return []WebhookDeliveryAttempt{{
			ID:             1,
			SubscriptionID: gotID,
			EventType:      "invoice.funded",
			EventID:        "1-1",
			Status:         "delivered",
			Attempts:       1,
			MaxAttempts:    5,
			NextAttemptAt:  time.Now(),
			CreatedAt:      time.Now(),
			UpdatedAt:      time.Now(),
		}}, true, nil
	}

	req := httptest.NewRequest(http.MethodGet, "/webhooks/"+id.String()+"/deliveries", nil)
	req = req.WithContext(WithUserAddress(req.Context(), "GADDR..."))
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", id.String())
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

	w := httptest.NewRecorder()
	h.HandleGetWebhookDeliveries(w, req)

	body := w.Body.String()
	for _, forbidden := range []string{"target_url", "signing_secret", "endpoint_secret", "payload"} {
		if strings.Contains(body, forbidden) {
			t.Errorf("response leaks %q: %s", forbidden, body)
		}
	}
}

func TestHandleDeleteWebhook(t *testing.T) {
	h := newTestHandler(t)

	// Mock DB function
	origDel := deleteWebhookSub
	defer func() { deleteWebhookSub = origDel }()
	deleteWebhookSub = func(ctx context.Context, id uuid.UUID, userAddr string) (int64, error) {
		if id == uuid.MustParse("00000000-0000-0000-0000-000000000001") {
			return 1, nil
		}
		return 0, nil
	}

	tests := []struct {
		name       string
		id         string
		withAddr   bool
		wantStatus int
	}{
		{"missing address", "00000000-0000-0000-0000-000000000001", false, http.StatusUnauthorized},
		{"invalid id", "abc", true, http.StatusBadRequest},
		{"not found", "00000000-0000-0000-0000-000000000099", true, http.StatusNotFound},
		{"success", "00000000-0000-0000-0000-000000000001", true, http.StatusNoContent},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodDelete, "/webhooks/"+tt.id, nil)
			if tt.withAddr {
				req = req.WithContext(WithUserAddress(req.Context(), "GADDR..."))
			}

			// Inject the chi url param
			rctx := chi.NewRouteContext()
			rctx.URLParams.Add("id", tt.id)
			req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

			w := httptest.NewRecorder()
			h.HandleDeleteWebhook(w, req)

			if w.Code != tt.wantStatus {
				t.Errorf("got %d, want %d", w.Code, tt.wantStatus)
			}
		})
	}
}
