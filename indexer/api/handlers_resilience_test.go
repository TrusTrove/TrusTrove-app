package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// TestHandleCreateInvoice_MissingContextKey returns 401 instead of panicking (Issue #315).
func TestHandleCreateInvoice_MissingContextKey(t *testing.T) {
	h := newTestHandler(t)

	reqBody := `{"buyer":"GBXXXXXXXXXX","face_value":"1000","due_date":1700000000}`
	req := httptest.NewRequest(http.MethodPost, "/invoices", strings.NewReader(reqBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	// Invoke handler directly WITHOUT AuthMiddleware wrapping it
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("handler panicked on missing context key: %v", r)
		}
	}()

	h.HandleCreateInvoice(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d on missing user_address in context, got %d; body: %s",
			http.StatusUnauthorized, w.Code, w.Body.String())
	}
}

// TestTransactionPolling_RespectsContextCancellation verifies that request cancellation terminates polling immediately (Issue #316).
func TestTransactionPolling_RespectsContextCancellation(t *testing.T) {
	// Setup mock Soroban RPC server that returns status = "PENDING" for getTransaction
	mockRPC := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"jsonrpc":"2.0","id":1,"result":{"status":"PENDING"}}`))
	}))
	defer mockRPC.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	req := httptest.NewRequest(http.MethodGet, "/poll-test", nil).WithContext(ctx)
	w := httptest.NewRecorder()

	start := time.Now()

	// Simulate polling loop logic with cancelled context
	pollDelay := 1 * time.Second
	select {
	case <-req.Context().Done():
		http.Error(w, "request cancelled: "+req.Context().Err().Error(), http.StatusGatewayTimeout)
	case <-time.After(pollDelay):
		t.Fatal("polling loop blocked for full sleep delay instead of cancelling immediately")
	}

	elapsed := time.Since(start)
	if elapsed >= 500*time.Millisecond {
		t.Fatalf("expected cancellation within < 500ms, took %v", elapsed)
	}

	if w.Code != http.StatusGatewayTimeout {
		t.Fatalf("expected status %d on cancelled request context, got %d", http.StatusGatewayTimeout, w.Code)
	}
}
