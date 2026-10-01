package soroban

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// TestCallSorobanRPC_Timeout verifies that CallSorobanRPC respects context cancellation / timeouts (Issue #314).
func TestCallSorobanRPC_Timeout(t *testing.T) {
	// Create slow server that blocks for 500ms before returning
	slowServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(500 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"jsonrpc":"2.0","id":1,"result":{}}`))
	}))
	defer slowServer.Close()

	// Call with short context timeout (50ms)
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	var result map[string]interface{}
	err := CallSorobanRPC(ctx, slowServer.URL, "testMethod", nil, &result)
	if err == nil {
		t.Fatal("expected CallSorobanRPC to error out due to context timeout, but got nil")
	}
}
