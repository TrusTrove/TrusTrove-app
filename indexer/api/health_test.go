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

func TestListenerHealth_MarkHeartbeat_UpdatesTimestamp(t *testing.T) {
	h := NewListenerHealth()
	h.MarkStarted()

	h.mu.RLock()
	first := h.lastHeartbeat
	h.mu.RUnlock()

	time.Sleep(time.Millisecond)
	h.MarkHeartbeat()

	h.mu.RLock()
	second := h.lastHeartbeat
	h.mu.RUnlock()

	if !second.After(first) {
		t.Fatalf("expected lastHeartbeat to advance, first=%v second=%v", first, second)
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
