package webhooks

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"trusttrove/indexer/db"
)

// fakeDelivery builds an in-memory claimed row. The worker only reads these
// fields when attempting, so no database is needed to exercise the pool.
func fakeDelivery(i int) *db.WebhookDelivery {
	return &db.WebhookDelivery{
		ID:             int64(i + 1),
		EventType:      "invoice.funded",
		EventID:        fmt.Sprintf("evt-%d", i),
		Payload:        json.RawMessage(`{"invoice_id":"INV-1"}`),
		Attempts:       0,
		MaxAttempts:    5,
		NextAttemptAt:  time.Now(),
		Status:         "pending",
		EndpointURL:    fmt.Sprintf("https://subscriber%d.invalid/hook", i),
		EndpointSecret: "synthetic-secret",
	}
}

func TestNewDeliveryWorkerDefaultsNonPositivePoolSettings(t *testing.T) {
	cases := []struct {
		name            string
		cfg             WorkerConfig
		wantConcurrency int
		wantLock        time.Duration
	}{
		{"zero value config", WorkerConfig{}, defaultConcurrency, defaultLockDuration},
		{"explicit zero concurrency", WorkerConfig{Concurrency: 0}, defaultConcurrency, defaultLockDuration},
		{"negative concurrency", WorkerConfig{Concurrency: -4}, defaultConcurrency, defaultLockDuration},
		{"negative lock duration", WorkerConfig{LockDuration: -time.Second}, defaultConcurrency, defaultLockDuration},
		{"configured values are kept", WorkerConfig{Concurrency: 3, LockDuration: 90 * time.Second}, 3, 90 * time.Second},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			w := NewDeliveryWorker(tc.cfg)
			if w.cfg.Concurrency != tc.wantConcurrency {
				t.Errorf("Concurrency: got %d, want %d", w.cfg.Concurrency, tc.wantConcurrency)
			}
			if w.cfg.LockDuration != tc.wantLock {
				t.Errorf("LockDuration: got %v, want %v", w.cfg.LockDuration, tc.wantLock)
			}
			if w.attempt == nil {
				t.Error("attempt seam not wired by NewDeliveryWorker")
			}
		})
	}
}

// TestNewDeliveryWorkerUsesOneSharedClient pins the connection-reuse half of
// #933: the whole pool attempts through a single Client/Transport.
func TestNewDeliveryWorkerUsesOneSharedClient(t *testing.T) {
	w := NewDeliveryWorker(WorkerConfig{Concurrency: 8, HTTPTimeout: 7 * time.Second})

	if w.client == nil {
		t.Fatal("no shared http.Client")
	}
	if w.client.Timeout != 7*time.Second {
		t.Errorf("client.Timeout: got %v, want 7s", w.client.Timeout)
	}
	transport, ok := w.client.Transport.(*http.Transport)
	if !ok {
		t.Fatalf("client.Transport: got %T, want *http.Transport", w.client.Transport)
	}
	// A clone, not the process-wide DefaultTransport: mutating the shared
	// default would change HTTP behaviour for every other caller in the binary.
	if transport == http.DefaultTransport.(*http.Transport) {
		t.Error("worker reuses http.DefaultTransport instead of its own clone")
	}
	if transport.ResponseHeaderTimeout != 7*time.Second {
		t.Errorf("ResponseHeaderTimeout: got %v, want 7s", transport.ResponseHeaderTimeout)
	}
}

// TestDeliverBatchBoundsConcurrency is the pool's core guarantee: at most
// Concurrency deliveries are in flight, and every claimed row is attempted
// exactly once.
func TestDeliverBatchBoundsConcurrency(t *testing.T) {
	const total = 24

	for _, concurrency := range []int{1, 3, 8} {
		t.Run(fmt.Sprintf("concurrency=%d", concurrency), func(t *testing.T) {
			w := NewDeliveryWorker(WorkerConfig{Concurrency: concurrency, BatchSize: total})

			var mu sync.Mutex
			inFlight, peak := 0, 0
			attempted := make(map[int64]int)

			w.attempt = func(_ context.Context, d *db.WebhookDelivery) {
				mu.Lock()
				inFlight++
				if inFlight > peak {
					peak = inFlight
				}
				attempted[d.ID]++
				mu.Unlock()

				// Long enough that the send loop cannot drain the pool before
				// it has filled it.
				time.Sleep(10 * time.Millisecond)

				mu.Lock()
				inFlight--
				mu.Unlock()
			}

			deliveries := make([]*db.WebhookDelivery, total)
			for i := range deliveries {
				deliveries[i] = fakeDelivery(i)
			}

			w.deliverBatch(context.Background(), deliveries)

			mu.Lock()
			defer mu.Unlock()
			if peak > concurrency {
				t.Errorf("peak in-flight %d exceeds configured concurrency %d", peak, concurrency)
			}
			if peak < concurrency {
				t.Errorf("peak in-flight %d never reached concurrency %d; the pool is not parallel", peak, concurrency)
			}
			if len(attempted) != total {
				t.Fatalf("attempted %d distinct deliveries, want %d", len(attempted), total)
			}
			for id, n := range attempted {
				if n != 1 {
					t.Errorf("delivery %d attempted %d times, want exactly 1", id, n)
				}
			}
		})
	}
}

// TestDeliverBatchStopsOnCancelledContext: shutdown must not fan out a batch it
// can no longer report results for.
func TestDeliverBatchStopsOnCancelledContext(t *testing.T) {
	w := NewDeliveryWorker(WorkerConfig{Concurrency: 4})

	var attempts atomic.Int64
	w.attempt = func(context.Context, *db.WebhookDelivery) { attempts.Add(1) }

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	deliveries := []*db.WebhookDelivery{fakeDelivery(0), fakeDelivery(1)}
	w.deliverBatch(ctx, deliveries)

	if got := attempts.Load(); got != 0 {
		t.Errorf("attempts after cancelled context: got %d, want 0", got)
	}
}

// TestDeliverBatchWaitsForTheBatch guarantees processBatch never returns while
// an attempt is still running, which is what keeps a slow tick from stacking
// overlapping batches on top of each other.
func TestDeliverBatchWaitsForTheBatch(t *testing.T) {
	w := NewDeliveryWorker(WorkerConfig{Concurrency: 2})

	release := make(chan struct{})
	var done atomic.Int64
	w.attempt = func(context.Context, *db.WebhookDelivery) {
		<-release
		done.Add(1)
	}

	deliveries := []*db.WebhookDelivery{fakeDelivery(0), fakeDelivery(1)}
	finished := make(chan struct{})
	go func() {
		w.deliverBatch(context.Background(), deliveries)
		close(finished)
	}()

	select {
	case <-finished:
		t.Fatal("deliverBatch returned while attempts were still blocked")
	case <-time.After(50 * time.Millisecond):
	}

	close(release)
	select {
	case <-finished:
	case <-time.After(2 * time.Second):
		t.Fatal("deliverBatch never returned after attempts completed")
	}
	if got := done.Load(); got != 2 {
		t.Errorf("attempts completed: got %d, want 2", got)
	}
}
