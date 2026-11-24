package api

import (
	"context"
	"testing"
	"time"

	"trusttrove/indexer/db"
)

func TestNewListenerHealth_StartsUnhealthy(t *testing.T) {
	h := NewListenerHealth()
	if h.IsHealthy() {
		t.Fatal("expected freshly constructed ListenerHealth to be unhealthy")
	}
}

func TestListenerHealth_MarkStarted(t *testing.T) {
	tests := []struct {
		name string
		run  func(h *ListenerHealth)
		want bool
	}{
		{
			name: "MarkStarted makes it healthy",
			run:  func(h *ListenerHealth) { h.MarkStarted() },
			want: true,
		},
		{
			name: "MarkStarted then MarkStopped is unhealthy",
			run: func(h *ListenerHealth) {
				h.MarkStarted()
				h.MarkStopped()
			},
			want: false,
		},
		{
			name: "MarkStarted then MarkHeartbeat stays healthy",
			run: func(h *ListenerHealth) {
				h.MarkStarted()
				h.MarkHeartbeat()
			},
			want: true,
		},
		{
			name: "MarkHeartbeat after MarkStopped is a no-op",
			run: func(h *ListenerHealth) {
				h.MarkStarted()
				h.MarkStopped()
				h.MarkHeartbeat()
			},
			want: false,
		},
		{
			name: "MarkStarted after MarkStopped resets to healthy",
			run: func(h *ListenerHealth) {
				h.MarkStarted()
				h.MarkStopped()
				h.MarkStarted()
			},
			want: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := NewListenerHealth()
			tt.run(h)
			if got := h.IsHealthy(); got != tt.want {
				t.Fatalf("IsHealthy() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestListenerHealth_MarkStopped_ClearsHeartbeat(t *testing.T) {
	h := NewListenerHealth()
	h.MarkStarted()
	h.MarkStopped()

	h.mu.RLock()
	defer h.mu.RUnlock()
	if !h.lastHeartbeat.IsZero() {
		t.Fatal("expected lastHeartbeat to be reset to zero after MarkStopped")
	}
	if h.running {
		t.Fatal("expected running to be false after MarkStopped")
	}
	if !h.stopped {
		t.Fatal("expected stopped to be true after MarkStopped")
	}
}

// fakeClock is a manually advanced clock so heartbeat tests never sleep.
type fakeClock struct {
	now time.Time
}

func (c *fakeClock) Now() time.Time { return c.now }

func (c *fakeClock) Advance(d time.Duration) { c.now = c.now.Add(d) }

func TestListenerHealth_MarkHeartbeat_UpdatesTimestamp(t *testing.T) {
	clock := &fakeClock{now: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)}
	h := NewListenerHealth()
	h.now = clock.Now
	h.MarkStarted()

	h.mu.RLock()
	first := h.lastHeartbeat
	h.mu.RUnlock()

	clock.Advance(time.Second)
	h.MarkHeartbeat()

	h.mu.RLock()
	second := h.lastHeartbeat
	h.mu.RUnlock()

	if !second.After(first) {
		t.Fatalf("expected lastHeartbeat to advance, first=%v second=%v", first, second)
	}
}

// TestListenerHealth_HeartbeatStaleness verifies a wedged listener is reported
// unhealthy once its heartbeat ages past the threshold, without sleeping
// (issue #941).
func TestListenerHealth_HeartbeatStaleness(t *testing.T) {
	clock := &fakeClock{now: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)}
	h := NewListenerHealth(10 * time.Second)
	h.now = clock.Now

	if got, want := h.staleAfter, 30*time.Second; got != want {
		t.Fatalf("staleAfter = %v, want %v", got, want)
	}

	h.MarkStarted()
	if !h.IsHealthy() {
		t.Fatal("expected a fresh heartbeat to be healthy")
	}

	clock.Advance(30 * time.Second)
	if !h.IsHealthy() {
		t.Fatal("expected a heartbeat at the threshold boundary to remain healthy")
	}

	clock.Advance(time.Second)
	if h.IsHealthy() {
		t.Fatal("expected a heartbeat past the threshold to be unhealthy")
	}

	h.MarkHeartbeat()
	if !h.IsHealthy() {
		t.Fatal("expected a fresh heartbeat to restore health")
	}

	h.MarkStopped()
	if h.IsHealthy() {
		t.Fatal("expected a stopped listener to be unhealthy")
	}
}

func TestHeartbeatStaleAfter(t *testing.T) {
	tests := []struct {
		name string
		poll time.Duration
		want time.Duration
	}{
		{name: "zero interval uses floor", poll: 0, want: 30 * time.Second},
		{name: "short interval uses floor", poll: 5 * time.Second, want: 30 * time.Second},
		{name: "interval at floor boundary", poll: 10 * time.Second, want: 30 * time.Second},
		{name: "long interval scales by three", poll: 20 * time.Second, want: 60 * time.Second},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := HeartbeatStaleAfter(tt.poll); got != tt.want {
				t.Fatalf("HeartbeatStaleAfter(%v) = %v, want %v", tt.poll, got, tt.want)
			}
		})
	}
}

// TestListenerHealth_SetPollInterval verifies the threshold can be updated
// after construction.
func TestListenerHealth_SetPollInterval(t *testing.T) {
	clock := &fakeClock{now: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)}
	h := NewListenerHealth()
	h.now = clock.Now
	h.MarkStarted()

	h.SetPollInterval(60 * time.Second)
	clock.Advance(179 * time.Second)
	if !h.IsHealthy() {
		t.Fatal("expected heartbeat inside the scaled threshold to be healthy")
	}
	clock.Advance(2 * time.Second)
	if h.IsHealthy() {
		t.Fatal("expected heartbeat past the scaled threshold to be unhealthy")
	}
}

func TestDefaultDBHealthChecker_NilPoolReturnsError(t *testing.T) {
	originalPool := db.Pool
	db.Pool = nil
	defer func() { db.Pool = originalPool }()

	err := defaultDBHealthChecker(context.Background())
	if err == nil {
		t.Fatal("expected error when db.Pool is not initialized, got nil")
	}
}
