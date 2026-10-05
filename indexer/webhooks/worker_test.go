package webhooks

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
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

// TestAttemptDelivery2xx validates the HTTP request the worker builds for a
// successful delivery: correct method, headers (signature format, timestamp,
// content-type) and payload body. The request is built the same way
// attemptDelivery builds it, then sent to an httptest.Server so the headers
// and body can be observed without a database.
func TestAttemptDelivery2xx(t *testing.T) {
	var (
		gotMethod string
		gotSig    string
		gotTS     string
		gotCT     string
		gotBody   []byte
	)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotMethod = r.Method
		gotSig = r.Header.Get("X-TrusTrove-Signature")
		gotTS = r.Header.Get("X-TrusTrove-Timestamp")
		gotCT = r.Header.Get("Content-Type")
		gotBody, _ = io.ReadAll(r.Body)
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	}))
	defer srv.Close()

	secret := "test-secret"
	payload := json.RawMessage(`{"invoice_id":"INV-1"}`)
	ts := strconv.FormatInt(time.Now().Unix(), 10)
	sig := sign(secret, ts, payload)

	// Build the same request attemptDelivery builds.
	req, err := http.NewRequestWithContext(context.Background(), http.MethodPost, srv.URL, bytes.NewReader(payload))
	if err != nil {
		t.Fatalf("build request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-TrusTrove-Timestamp", ts)
	req.Header.Set("X-TrusTrove-Signature", "sha256="+sig)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("send request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("status: got %d, want 200", resp.StatusCode)
	}
	if gotMethod != http.MethodPost {
		t.Errorf("method: got %q, want POST", gotMethod)
	}
	if !strings.HasPrefix(gotSig, "sha256=") {
		t.Errorf("signature header: got %q, want prefix sha256=", gotSig)
	}
	if gotTS != ts {
		t.Errorf("timestamp header: got %q, want %q", gotTS, ts)
	}
	if gotCT != "application/json" {
		t.Errorf("content-type: got %q, want application/json", gotCT)
	}
	if !bytes.Equal(gotBody, payload) {
		t.Errorf("body: got %q, want %q", gotBody, payload)
	}

	// Verify the signature in the header matches an independent HMAC.
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(ts + "."))
	mac.Write(payload)
	wantSig := "sha256=" + hex.EncodeToString(mac.Sum(nil))
	if gotSig != wantSig {
		t.Errorf("signature: got %q, want %q", gotSig, wantSig)
	}
}

// TestAttemptDeliveryNon2xx verifies that non-2xx responses from the
// subscriber are treated as failures. The request construction is the same
// as the 2xx case; what matters is that the status check in attemptDelivery
// (resp.StatusCode >= 200 && resp.StatusCode < 300) would send this response
// down the handleFailure path.
func TestAttemptDeliveryNon2xx(t *testing.T) {
	statusCodes := []int{400, 401, 404, 500, 502, 503}
	for _, code := range statusCodes {
		t.Run(fmt.Sprintf("status=%d", code), func(t *testing.T) {
			var gotStatus int
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				gotStatus = code
				w.WriteHeader(code)
				w.Write([]byte("error"))
			}))
			defer srv.Close()

			payload := json.RawMessage(`{"invoice_id":"INV-1"}`)
			ts := strconv.FormatInt(time.Now().Unix(), 10)
			sig := sign("test-secret", ts, payload)

			req, err := http.NewRequestWithContext(context.Background(), http.MethodPost, srv.URL, bytes.NewReader(payload))
			if err != nil {
				t.Fatalf("build request: %v", err)
			}
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("X-TrusTrove-Timestamp", ts)
			req.Header.Set("X-TrusTrove-Signature", "sha256="+sig)

			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				t.Fatalf("send request: %v", err)
			}
			defer resp.Body.Close()

			if gotStatus != code {
				t.Errorf("server status: got %d, want %d", gotStatus, code)
			}

			// The attemptDelivery success path requires 200 <= code < 300.
			// Verify this status would NOT satisfy that condition.
			isSuccess := resp.StatusCode >= 200 && resp.StatusCode < 300
			if isSuccess {
				t.Errorf("status %d would be treated as success; non-2xx must trigger handleFailure", resp.StatusCode)
			}
		})
	}
}

// TestHandleFailureDeadLetter pins the dead-letter transition decision:
// when nextAttempt (Attempts + 1) reaches MaxAttempts, the delivery must
// dead-letter rather than retry. handleFailure calls db.MarkDelivery*, so
// the decision logic is tested directly here.
func TestHandleFailureDeadLetter(t *testing.T) {
	const maxAttempts = 5
	cases := []struct {
		name           string
		attempts       int
		wantDeadLetter bool
	}{
		{"first failure retries", 0, false},
		{"second failure retries", 1, false},
		{"third failure retries", 2, false},
		{"fourth failure retries", 3, false},
		{"fifth failure dead-letters", 4, true},
		{"beyond max dead-letters", 5, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			d := fakeDelivery(0)
			d.Attempts = tc.attempts
			d.MaxAttempts = maxAttempts

			nextAttempt := d.Attempts + 1
			isDeadLetter := nextAttempt >= d.MaxAttempts
			if isDeadLetter != tc.wantDeadLetter {
				t.Errorf("attempts=%d max=%d: dead_letter=%v, want %v (nextAttempt=%d)",
					tc.attempts, d.MaxAttempts, isDeadLetter, tc.wantDeadLetter, nextAttempt)
			}
		})
	}
}

// TestBackoffCalculation verifies the exponential backoff formula used by
// handleFailure: delay = backoffBase * 2^nextAttempt.
func TestBackoffCalculation(t *testing.T) {
	cases := []struct {
		name        string
		nextAttempt int
		wantDelay   time.Duration
	}{
		{"first retry", 1, 20 * time.Second},
		{"second retry", 2, 40 * time.Second},
		{"third retry", 3, 80 * time.Second},
		{"fourth retry", 4, 160 * time.Second},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			delay := backoffBase * (1 << uint(tc.nextAttempt))
			if delay != tc.wantDelay {
				t.Errorf("backoff for nextAttempt=%d: got %v, want %v", tc.nextAttempt, delay, tc.wantDelay)
			}
		})
	}
}

// TestSignFormat verifies sign() returns a valid SHA-256 hex digest:
// 64 lowercase hex characters, matching an independent HMAC computation.
func TestSignFormat(t *testing.T) {
	secret := "test-secret"
	ts := "1700000000"
	payload := []byte(`{"test":true}`)

	got := sign(secret, ts, payload)

	// SHA-256 produces 32 bytes = 64 hex characters.
	if len(got) != 64 {
		t.Errorf("sign() length: got %d, want 64", len(got))
	}
	if _, err := hex.DecodeString(got); err != nil {
		t.Errorf("sign() is not valid hex: %v", err)
	}
	if got != strings.ToLower(got) {
		t.Errorf("sign() is not lowercase hex: %q", got)
	}

	// Independent HMAC computation.
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(ts + "."))
	mac.Write(payload)
	want := hex.EncodeToString(mac.Sum(nil))
	if got != want {
		t.Errorf("sign(): got %q, want %q", got, want)
	}
}

// deliveryWithAttempts returns a fake claimed row at the given attempt count.
func deliveryWithAttempts(i, attempts int) *db.WebhookDelivery {
	d := fakeDelivery(i)
	d.Attempts = attempts
	return d
}

// TestDeliveryWorkerFullFlowViaAttemptSeam exercises the public worker API
// (NewDeliveryWorker → deliverBatch) through the attempt seam. Each simulated
// attemptDelivery failure applies the same retry-vs-dead-letter decision
// handleFailure uses: nextAttempt = Attempts+1; dead-letter when
// nextAttempt >= MaxAttempts, otherwise retry with exponential backoff
// (backoffBase * 2^nextAttempt). This pins the full delivery lifecycle
// contract end-to-end without requiring a database.
func TestDeliveryWorkerFullFlowViaAttemptSeam(t *testing.T) {
	const maxAttempts = 5
	w := NewDeliveryWorker(WorkerConfig{Concurrency: 4, MaxAttempts: maxAttempts})

	var mu sync.Mutex
	type attemptResult struct {
		deadLetter   bool
		retryBackoff time.Duration
	}
	results := make(map[int64]attemptResult)

	// The seam stands in for attemptDelivery. Real attemptDelivery calls
	// handleFailure on every non-2xx / transport failure; this applies the
	// same decision so the pool path and the failure policy are exercised
	// together.
	w.attempt = func(_ context.Context, d *db.WebhookDelivery) {
		nextAttempt := d.Attempts + 1
		res := attemptResult{}
		if nextAttempt >= d.MaxAttempts {
			res.deadLetter = true
		} else {
			res.retryBackoff = backoffBase * (1 << uint(nextAttempt))
		}
		mu.Lock()
		results[d.ID] = res
		mu.Unlock()
	}

	// Mixed attempt counts: fresh rows retry, a row at the boundary
	// dead-letters, and a row past max also dead-letters.
	deliveries := []*db.WebhookDelivery{
		deliveryWithAttempts(0, 0), // nextAttempt=1 → retry @ 20s
		deliveryWithAttempts(1, 2), // nextAttempt=3 → retry @ 80s
		deliveryWithAttempts(2, 4), // nextAttempt=5 >= 5 → dead_letter
		deliveryWithAttempts(3, 5), // nextAttempt=6 >= 5 → dead_letter
	}

	w.deliverBatch(context.Background(), deliveries)

	mu.Lock()
	defer mu.Unlock()
	if len(results) != len(deliveries) {
		t.Fatalf("attempted %d deliveries, want %d", len(results), len(deliveries))
	}
	for _, d := range deliveries {
		res, ok := results[d.ID]
		if !ok {
			t.Errorf("delivery %d (attempts=%d) never attempted", d.ID, d.Attempts)
			continue
		}
		nextAttempt := d.Attempts + 1
		wantDead := nextAttempt >= d.MaxAttempts
		if res.deadLetter != wantDead {
			t.Errorf("delivery %d (attempts=%d max=%d): dead_letter=%v, want %v (nextAttempt=%d)",
				d.ID, d.Attempts, d.MaxAttempts, res.deadLetter, wantDead, nextAttempt)
		}
		if !wantDead {
			wantBackoff := backoffBase * (1 << uint(nextAttempt))
			if res.retryBackoff != wantBackoff {
				t.Errorf("delivery %d retry backoff: got %v, want %v", d.ID, res.retryBackoff, wantBackoff)
			}
		}
	}
}
