package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCORSMiddleware_AllowsConfiguredOrigin(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Origin", "https://trustrove.vercel.app")
	rr := httptest.NewRecorder()

	handler := CORSMiddleware([]string{"https://trustrove.vercel.app", "http://localhost:3000"})(next)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusTeapot {
		t.Fatalf("expected status %d, got %d", http.StatusTeapot, rr.Code)
	}

	if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "https://trustrove.vercel.app" {
		t.Fatalf("expected allowed origin to be forwarded, got %q", got)
	}
}

func TestCORSMiddleware_RejectsUnlistedOrigin(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Origin", "https://evil.example")
	rr := httptest.NewRecorder()

	handler := CORSMiddleware([]string{"https://trustrove.vercel.app", "http://localhost:3000"})(next)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected status %d, got %d", http.StatusForbidden, rr.Code)
	}

	if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("expected no CORS header for rejected origin, got %q", got)
	}
}

func TestHealthEndpoint_Returns200WhenListenerAndDBAreHealthy(t *testing.T) {
	h := newTestHandler(t)
	h.dbHealthChecker = func(context.Context) error { return nil }
	h.listenerHealth = NewListenerHealth()
	h.listenerHealth.MarkStarted()

	router := NewRouter(h)
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rr := httptest.NewRecorder()

	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d; body: %s", http.StatusOK, rr.Code, rr.Body.String())
	}
	if !strings.Contains(rr.Body.String(), `"status": "ok"`) {
		t.Fatalf("expected healthy payload, got %s", rr.Body.String())
	}
}

func TestHealthEndpoint_Returns503WhenListenerStops(t *testing.T) {
	h := newTestHandler(t)
	h.dbHealthChecker = func(context.Context) error { return nil }
	h.listenerHealth = NewListenerHealth()
	h.listenerHealth.MarkStopped()

	router := NewRouter(h)
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rr := httptest.NewRecorder()

	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status %d, got %d; body: %s", http.StatusServiceUnavailable, rr.Code, rr.Body.String())
	}
	if !strings.Contains(rr.Body.String(), `"status": "degraded"`) {
		t.Fatalf("expected degraded payload, got %s", rr.Body.String())
	}
}
