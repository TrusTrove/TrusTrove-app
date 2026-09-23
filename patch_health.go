package main

import (
	"os"
	"strings"
)

func main() {
	b, err := os.ReadFile("indexer/api/health.go")
	if err != nil {
		panic(err)
	}
	content := string(b)
	
	// Add prometheus imports
	content = strings.Replace(content, "\"trusttrove/indexer/db\"", "\"trusttrove/indexer/db\"\n\t\"github.com/prometheus/client_golang/prometheus\"\n\t\"github.com/prometheus/client_golang/prometheus/promauto\"", 1)
	
	// Add gauge variable
	gaugeStr := `var ledgerLagGauge = promauto.NewGauge(prometheus.GaugeOpts{
	Name: "trusttrove_indexer_ledger_lag",
	Help: "The difference between the last known chain tip and the last processed ledger.",
})`
	content = strings.Replace(content, "type ListenerHealth struct {", gaugeStr + "\n\ntype ListenerHealth struct {", 1)
	
	// Update ledgers
	oldUpdate := `func (h *ListenerHealth) UpdateLedgers(processed, tip int32) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.lastProcessedLedger = processed
	if tip > h.lastKnownChainTip {
		h.lastKnownChainTip = tip
	}
}`
	newUpdate := `func (h *ListenerHealth) UpdateLedgers(processed, tip int32) {
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
}`
	content = strings.Replace(content, oldUpdate, newUpdate, 1)

	os.WriteFile("indexer/api/health.go", []byte(content), 0644)
}
