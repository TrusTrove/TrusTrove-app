package api

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"trusttrove/indexer/db"
)

// ListenerHealth tracks whether the background listener is still alive.
var ledgerLagGauge = promauto.NewGauge(prometheus.GaugeOpts{
	Name: "trusttrove_indexer_ledger_lag",
	Help: "The difference between the last known chain tip and the last processed ledger.",
})

type ListenerHealth struct {
	mu                  sync.RWMutex
	running             bool
	stopped             bool
	lastHeartbeat       time.Time
	lastProcessedLedger int32
	lastKnownChainTip   int32
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

func (h *ListenerHealth) UpdateLedgers(processed, tip int32) {
	h.mu.Lock()
	h.lastProcessedLedger = processed
	if tip > h.lastKnownChainTip {
		h.lastKnownChainTip = tip
	}
	lag := int32(0)
	if h.lastKnownChainTip > h.lastProcessedLedger && h.lastProcessedLedger > 0 {
		lag = h.lastKnownChainTip - h.lastProcessedLedger
	}
	h.mu.Unlock()
	ledgerLagGauge.Set(float64(lag))
}

// GetLedgerLag returns the difference between the last known chain tip and the last processed ledger.
// Units: number of ledgers.
func (h *ListenerHealth) GetLedgerLag() int32 {
	h.mu.RLock()
	defer h.mu.RUnlock()
	if h.lastKnownChainTip > h.lastProcessedLedger && h.lastProcessedLedger > 0 {
		return h.lastKnownChainTip - h.lastProcessedLedger
	}
	return 0
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
