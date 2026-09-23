package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
)

func TestHandleCreateWebhook(t *testing.T) {
	h := newTestHandler(t)

	// Mock DB function
	origCreate := createWebhookSub
	defer func() { createWebhookSub = origCreate }()
	createWebhookSub = func(ctx context.Context, userAddr, u, secret string, eventTypes []string) (WebhookSubscription, error) {
		return WebhookSubscription{
			ID:          1,
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

func TestHandleGetWebhooks(t *testing.T) {
	h := newTestHandler(t)

	// Mock DB function
	origGet := getWebhookSubs
	defer func() { getWebhookSubs = origGet }()
	getWebhookSubs = func(ctx context.Context, userAddr string) ([]WebhookSubscription, error) {
		return []WebhookSubscription{
			{
				ID:          1,
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

func TestHandleDeleteWebhook(t *testing.T) {
	h := newTestHandler(t)

	// Mock DB function
	origDel := deleteWebhookSub
	defer func() { deleteWebhookSub = origDel }()
	deleteWebhookSub = func(ctx context.Context, id int, userAddr string) (int64, error) {
		if id == 1 {
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
		{"missing address", "1", false, http.StatusUnauthorized},
		{"invalid id", "abc", true, http.StatusBadRequest},
		{"not found", "99", true, http.StatusNotFound},
		{"success", "1", true, http.StatusNoContent},
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
