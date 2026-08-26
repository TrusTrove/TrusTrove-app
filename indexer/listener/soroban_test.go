package listener

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"trusttrove/indexer/api"
	"trusttrove/indexer/config"

	"github.com/stellar/go-stellar-sdk/keypair"
)

// stubSorobanRPC starts an httptest.Server that responds with a JSON-RPC
// envelope ({"jsonrpc":"2.0","id":1,"result":body}) using the handler.
// Cleanup is registered with t.Cleanup.
func stubSorobanRPC(t *testing.T, handler func(method string) (body any, status int)) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Method string `json:"method"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		body, status := handler(req.Method)
		if status != http.StatusOK {
			w.WriteHeader(status)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"jsonrpc": "2.0",
			"id":      1,
			"result":  body,
		})
	}))
	t.Cleanup(server.Close)
	return server
}

// newTestEventListener builds an EventListener whose DB-touching fns are
// stubbed to return empty values, so tests do not depend on a live db.Pool.
// Override individual fields in a test when its scenario needs real behavior.
func newTestEventListener(t *testing.T, cfgOverrides ...func(*config.Config)) *EventListener {
	t.Helper()
	kp, err := keypair.Random()
	if err != nil {
		t.Fatalf("failed to generate random keypair: %v", err)
	}
	cfg := &config.Config{
		StellarNetwork:        "testnet",
		IndexerPollIntervalMs: 50,
		ServerSeed:            kp.Seed(),
		NetworkPassphrase:     "Test SDF Network ; September 2015",
		JWTSecret:             "test-secret",
	}
	for _, fn := range cfgOverrides {
		fn(cfg)
	}
	l := NewEventListener(cfg, api.NewListenerHealth())
	// Defaults: zero-valued no-ops. Each test that needs real behavior
	// (e.g. TestStart_GetCheckpointErrorIsReturned) overrides the field below.
	l.getCheckpointFn = func(_ context.Context) (int32, error) { return 0, nil }
	l.getLatestProcessedLedgerFn = func(_ context.Context) (int32, error) { return 0, nil }
	l.upsertCheckpointFn = func(_ context.Context, _ int32) error { return nil }
	l.isEventProcessedFn = func(_ context.Context, _ string) (bool, error) { return false, nil }
	return l
}

// ------------------------------------------------------------------
// pollEvents
// ------------------------------------------------------------------

func TestPollEvents_NoContractIDsReturnsLatestPlusOne(t *testing.T) {
	const wantLatest int32 = 5000
	var gotMethod string
	server := stubSorobanRPC(t, func(method string) (any, int) {
		gotMethod = method
		if method != "getLatestLedger" {
			t.Errorf("expected getLatestLedger, got %s", method)
		}
		return map[string]any{"sequence": wantLatest}, http.StatusOK
	})

	l := newTestEventListener(t, func(c *config.Config) { c.SorobanRPCURL = server.URL })

	got, err := l.pollEvents(context.Background(), 100)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if gotMethod != "getLatestLedger" {
		t.Errorf("expected rpc method=getLatestLedger, got %s", gotMethod)
	}
	if got != wantLatest+1 {
		t.Errorf("expected latest+1 = %d, got %d", wantLatest+1, got)
	}
}

func TestPollEvents_EmptyEventsReturnsLatestPlusOne(t *testing.T) {
	const inputStart int32 = 100
	const latestLedger int32 = 250
	var eventCalls int32

	server := stubSorobanRPC(t, func(method string) (any, int) {
		switch method {
		case "getEvents":
			atomic.AddInt32(&eventCalls, 1)
			return map[string]any{
				"events":       []any{},
				"latestLedger": uint32(latestLedger),
				"cursor":       "",
			}, http.StatusOK
		case "getLatestLedger":
			return map[string]any{"sequence": latestLedger}, http.StatusOK
		default:
			t.Errorf("unexpected RPC method: %s", method)
			return nil, http.StatusOK
		}
	})

	l := newTestEventListener(t, func(c *config.Config) {
		c.SorobanRPCURL = server.URL
		c.RegistryContractID = "CABGWVIZFF62FG67ZGFEP67NEEY4WYTMFURDMFTKKNRDAFPKPOJDTN4C"
		c.InvoiceContractID = "CA4O3MR7LWHRSUDBNU6FY6UDFFYBN7TGBZXBDZB4OYYXFYXIFJ6RJF6B"
	})
	// isEventProcessed is wired to a no-op by newTestEventListener, but assert
	// it's never invoked when the events array is empty.
	l.isEventProcessedFn = func(_ context.Context, _ string) (bool, error) {
		t.Error("isEventProcessed should not be called when the events array is empty")
		return false, nil
	}

	got, err := l.pollEvents(context.Background(), inputStart)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if atomic.LoadInt32(&eventCalls) < 1 {
		t.Error("expected at least one getEvents call when contract IDs are configured")
	}
	if got != latestLedger+1 {
		t.Errorf("expected latest+1 = %d, got %d", latestLedger+1, got)
	}
}

func TestPollEvents_RPCErrorIsPropagated(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	t.Cleanup(server.Close)

	l := newTestEventListener(t, func(c *config.Config) {
		c.SorobanRPCURL = server.URL
		// Enter the contract-id branch so the very first RPC call is getEvents
		c.RegistryContractID = "CABGWVIZFF62FG67ZGFEP67NEEY4WYTMFURDMFTKKNRDAFPKPOJDTN4C"
	})

	if _, err := l.pollEvents(context.Background(), 100); err == nil {
		t.Fatal("expected error when RPC returns HTTP 500")
	}
}

// ------------------------------------------------------------------
// Start
// ------------------------------------------------------------------

func TestStart_ContextCancelReturnsNil(t *testing.T) {
	server := stubSorobanRPC(t, func(_ string) (any, int) {
		return map[string]any{"sequence": int32(100)}, http.StatusOK
	})
	l := newTestEventListener(t, func(c *config.Config) {
		c.SorobanRPCURL = server.URL
		c.IndexerPollIntervalMs = 1000 // slow polling; we cancel before first tick
	})
	l.health.MarkStarted()

	errCh := make(chan error, 1)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel() // safety net: unblock the goroutine if any assertion below fires

	go func() { errCh <- l.Start(ctx) }()

	// Give Start a tiny moment to enter the select loop, then cancel.
	time.Sleep(20 * time.Millisecond)
	cancel() // drives Start's ctx.Done() branch

	select {
	case err := <-errCh:
		if err != nil {
			t.Errorf("expected nil error on ctx cancel, got %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("Start did not return within 2s after ctx cancel")
	}
	if l.health.IsHealthy() {
		t.Error("expected listener health to be unhealthy after MarkStopped")
	}
}

func TestStart_GetCheckpointErrorIsReturned(t *testing.T) {
	l := newTestEventListener(t)
	wantErr := errors.New("checkpoint db down")
	l.getCheckpointFn = func(_ context.Context) (int32, error) {
		return 0, wantErr
	}

	err := l.Start(context.Background())
	if err == nil {
		t.Fatal("expected error from getCheckpoint failure")
	}
	if !strings.Contains(err.Error(), "checkpoint") {
		t.Errorf("expected 'checkpoint' in wrapped error, got %v", err)
	}
}

func TestStart_ProcessesAtLeastOnceThenStopsOnCancel(t *testing.T) {
	const latestLedger int32 = 500
	var pollCount int32
	server := stubSorobanRPC(t, func(method string) (any, int) {
		atomic.AddInt32(&pollCount, 1)
		switch method {
		case "getEvents":
			// Must return empty events so handleEvent's DB writes are never invoked.
			return map[string]any{
				"events":       []any{},
				"latestLedger": uint32(latestLedger),
				"cursor":       "",
			}, http.StatusOK
		case "getLatestLedger":
			return map[string]any{"sequence": latestLedger}, http.StatusOK
		default:
			t.Errorf("unexpected method: %s", method)
			return nil, http.StatusOK
		}
	})

	l := newTestEventListener(t, func(c *config.Config) {
		c.SorobanRPCURL = server.URL
		c.IndexerPollIntervalMs = 10 // very tight loop
		c.RegistryContractID = "CABGWVIZFF62FG67ZGFEP67NEEY4WYTMFURDMFTKKNRDAFPKPOJDTN4C"
	})

	// No events → upsertCheckpoint still runs (test that wire is connected).
	l.upsertCheckpointFn = func(_ context.Context, ledger int32) error {
		if ledger != latestLedger+1 {
			t.Errorf("expected checkpoint=latest+1=%d, got %d", latestLedger+1, ledger)
		}
		return nil
	}

	errCh := make(chan error, 1)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel() // safety net
	go func() { errCh <- l.Start(ctx) }()

	// Wait for at least one poll iteration to occur.
	deadline := time.Now().Add(500 * time.Millisecond)
	for atomic.LoadInt32(&pollCount) == 0 {
		if time.Now().After(deadline) {
			t.Fatal("listener never invoked RPC after 500ms")
		}
		time.Sleep(5 * time.Millisecond)
	}

	cancel() // drives Start's ctx.Done() branch after at least one iteration

	select {
	case err := <-errCh:
		if err != nil {
			t.Errorf("expected nil error on ctx cancel after iteration, got %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("Start did not return within 2s after cancel")
	}
	if l.health.IsHealthy() {
		// By the time Start returns via ctx.Done() (or after a final
		// iteration fails to find a non-cancelled ctx), MarkStopped has
		// been called and IsHealthy should report false.
		t.Error("expected listener health to be unhealthy after MarkStopped")
	}
}
