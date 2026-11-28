package api

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"trusttrove/indexer/db"
)

const (
	// minHeartbeatStaleAfter is the floor for the heartbeat staleness
	// threshold so short poll intervals do not produce false positives.
	minHeartbeatStaleAfter = 30 * time.Second
	// heartbeatStaleAfterMultiplier is how many poll intervals may pass
	// without a heartbeat before the listener is considered wedged.
	heartbeatStaleAfterMultiplier = 3
)

// ListenerHealth tracks whether the background listener is still alive.
type ListenerHealth struct {
	mu            sync.RWMutex
	running       bool
	stopped       bool
	lastHeartbeat time.Time
	staleAfter    time.Duration
	now           func() time.Time
	Lag           int
}

var LedgerLag = prometheus.NewGauge(prometheus.GaugeOpts{
	Name: "stellar_ledger_lag",
	Help: "Ledger lag between horizon and local.",
})

func init() {
	prometheus.MustRegister(LedgerLag)
}

// NewListenerHealth creates a health tracker. An optional poll interval derives
// the heartbeat staleness threshold from the listener's cadence; when omitted
// the default floor applies.
func NewListenerHealth(pollInterval ...time.Duration) *ListenerHealth {
	h := &ListenerHealth{
		staleAfter: minHeartbeatStaleAfter,
		now:        time.Now,
	}
	if len(pollInterval) > 0 {
		h.staleAfter = HeartbeatStaleAfter(pollInterval[0])
	}
	return h
}

// HeartbeatStaleAfter derives how long the listener may go without a heartbeat
// before it is considered unhealthy: at least heartbeatStaleAfterMultiplier poll
// intervals, floored at minHeartbeatStaleAfter.
func HeartbeatStaleAfter(pollInterval time.Duration) time.Duration {
	if pollInterval <= 0 {
		return minHeartbeatStaleAfter
	}
	d := heartbeatStaleAfterMultiplier * pollInterval
	if d < minHeartbeatStaleAfter {
		return minHeartbeatStaleAfter
	}
	return d
}

// SetPollInterval updates the staleness threshold from the configured poll
// interval.
func (h *ListenerHealth) SetPollInterval(pollInterval time.Duration) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.staleAfter = HeartbeatStaleAfter(pollInterval)
}

// clock returns the current time, honoring the injectable clock used by tests.
func (h *ListenerHealth) clock() time.Time {
	if h.now != nil {
		return h.now()
	}
	return time.Now()
}

func (h *ListenerHealth) MarkStarted() {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.running = true
	h.stopped = false
	h.lastHeartbeat = h.clock()
}

func (h *ListenerHealth) MarkHeartbeat() {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.stopped {
		return
	}
	h.running = true
	h.lastHeartbeat = h.clock()
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
	if h.stopped || !h.running || h.lastHeartbeat.IsZero() {
		return false
	}

	staleAfter := h.staleAfter
	if staleAfter <= 0 {
		staleAfter = minHeartbeatStaleAfter
	}
	return h.clock().Sub(h.lastHeartbeat) <= staleAfter
}

func defaultDBHealthChecker(ctx context.Context) error {
	if db.Pool == nil {
		return fmt.Errorf("database pool not initialized")
	}
	return db.Pool.Ping(ctx)
}
