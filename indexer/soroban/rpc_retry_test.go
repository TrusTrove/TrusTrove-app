package soroban

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

// withFastRetries shrinks the retry backoff for the duration of a test so
// retry paths exercise quickly, restoring the defaults afterwards.
func withFastRetries(t *testing.T) {
	t.Helper()
	oldBase, oldMax := RPCRetryBaseDelay, RPCMaxRetries
	RPCRetryBaseDelay = time.Millisecond
	RPCMaxRetries = 3
	t.Cleanup(func() {
		RPCRetryBaseDelay = oldBase
		RPCMaxRetries = oldMax
	})
}

func writeJSONRPCResult(t *testing.T, w http.ResponseWriter, result any) {
	t.Helper()
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"result":  result,
	}); err != nil {
		t.Fatalf("encode JSON-RPC result: %v", err)
	}
}

// TestCallSorobanRPC_RetriesTransientFailuresThenSucceeds simulates two
// transient HTTP 500 failures followed by success and asserts the call
// ultimately succeeds (Issue #780).
func TestCallSorobanRPC_RetriesTransientFailuresThenSucceeds(t *testing.T) {
	withFastRetries(t)

	var attempts atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		if attempts.Add(1) <= 2 {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		writeJSONRPCResult(t, w, map[string]any{"sequence": int32(999)})
	}))
	t.Cleanup(server.Close)

	var result struct {
		Sequence int32 `json:"sequence"`
	}
	if err := CallSorobanRPC(context.Background(), server.URL, "getLatestLedger", nil, &result); err != nil {
		t.Fatalf("expected success after transient failures, got %v", err)
	}
	if result.Sequence != 999 {
		t.Errorf("expected sequence=999, got %d", result.Sequence)
	}
	if got := attempts.Load(); got != 3 {
		t.Errorf("expected 3 attempts (2 failures + success), got %d", got)
	}
}

// TestCallSorobanRPC_RetriesRateLimitedThenSucceeds verifies HTTP 429 is
// treated as retryable.
func TestCallSorobanRPC_RetriesRateLimitedThenSucceeds(t *testing.T) {
	withFastRetries(t)

	var attempts atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		if attempts.Add(1) == 1 {
			w.WriteHeader(http.StatusTooManyRequests)
			return
		}
		writeJSONRPCResult(t, w, map[string]any{"sequence": int32(7)})
	}))
	t.Cleanup(server.Close)

	var result struct {
		Sequence int32 `json:"sequence"`
	}
	if err := CallSorobanRPC(context.Background(), server.URL, "getLatestLedger", nil, &result); err != nil {
		t.Fatalf("expected success after 429, got %v", err)
	}
	if got := attempts.Load(); got != 2 {
		t.Errorf("expected 2 attempts (1 rate-limit + success), got %d", got)
	}
}

// TestCallSorobanRPC_NonRetryable4xxFailsFast asserts a 400 response fails
// immediately without any retry (Issue #780).
func TestCallSorobanRPC_NonRetryable4xxFailsFast(t *testing.T) {
	withFastRetries(t)

	var attempts atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		attempts.Add(1)
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte("bad request"))
	}))
	t.Cleanup(server.Close)

	var result any
	err := CallSorobanRPC(context.Background(), server.URL, "anything", nil, &result)
	if err == nil {
		t.Fatal("expected error for HTTP 400, got nil")
	}
	if !strings.Contains(err.Error(), "400") {
		t.Errorf("expected error to mention status 400, got %v", err)
	}
	if got := attempts.Load(); got != 1 {
		t.Errorf("expected exactly 1 attempt for non-retryable 400, got %d", got)
	}
}

// TestCallSorobanRPC_JSONRPCErrorFailsFast asserts a well-formed JSON-RPC
// error envelope fails immediately without retrying (Issue #780).
func TestCallSorobanRPC_JSONRPCErrorFailsFast(t *testing.T) {
	withFastRetries(t)

	var attempts atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		attempts.Add(1)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"jsonrpc": "2.0",
			"id":      1,
			"result":  nil,
			"error":   map[string]any{"code": -32600, "message": "malformed params"},
		})
	}))
	t.Cleanup(server.Close)

	var result any
	err := CallSorobanRPC(context.Background(), server.URL, "anything", nil, &result)
	if err == nil {
		t.Fatal("expected error for JSON-RPC error envelope, got nil")
	}
	if !strings.Contains(err.Error(), "malformed params") {
		t.Errorf("expected error to include server message, got %v", err)
	}
	if got := attempts.Load(); got != 1 {
		t.Errorf("expected exactly 1 attempt for JSON-RPC error, got %d", got)
	}
}
