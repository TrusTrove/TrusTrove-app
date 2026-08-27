package api

import (
	"context"
	"fmt"
	"sync"
	"time"

	"trusttrove/indexer/db"
)

// ListenerHealth tracks whether the background listener is still alive.
type ListenerHealth struct {
	mu            sync.RWMutex
	running       bool
	stopped       bool
	lastHeartbeat time.Time
}

func NewListenerHealth() *ListenerHealth {
	return &ListenerHealth{}
}

func (h *ListenerHealth) MarkStarted() {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.running = true
	h.stopped = false
	h.lastHeartbeat = time.Now()
}

func (h *ListenerHealth) MarkHeartbeat() {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.stopped {
		return
	}
	h.running = true
	h.lastHeartbeat = time.Now()
}

func (h *ListenerHealth) MarkStopped() {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.running = false
	h.stopped = true
	h.lastHeartbeat = time.Time{}
}

func (h *ListenerHealth) IsHealthy() bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	if h.stopped {
		return false
	}
	return h.running && !h.lastHeartbeat.IsZero()
}

func defaultDBHealthChecker(ctx context.Context) error {
	if db.Pool == nil {
		return fmt.Errorf("database pool not initialized")
	}
	return db.Pool.Ping(ctx)
}
