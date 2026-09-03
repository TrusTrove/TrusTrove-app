package api

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"trusttrove/indexer/db"
	"trusttrove/indexer/soroban"
	"trusttrove/indexer/xdrutil"

	"github.com/go-chi/chi/v5"
	"github.com/stellar/go-stellar-sdk/keypair"
	"github.com/stellar/go-stellar-sdk/xdr"
)

// GET /stats
func (h *APIHandler) HandleGetStats(w http.ResponseWriter, r *http.Request) {
	// Try to read the cache with a read lock
	h.statsMu.RLock()
	if h.statsData != nil && time.Since(h.statsCached) < 30*time.Second {
		data := h.statsData
		h.statsMu.RUnlock()
		writeJSON(w, http.StatusOK, data)
		return
	}
	h.statsMu.RUnlock()

	// Cache is missing or expired, we need to update it.
	// Take a write lock (but first we must release the read lock, which we did above).
	h.statsMu.Lock()
	// Double-check the cache after acquiring the write lock.
	if h.statsData != nil && time.Since(h.statsCached) < 30*time.Second {
		data := h.statsData
		h.statsMu.Unlock()
		writeJSON(w, http.StatusOK, data)
		return
	}

	// Cache is still invalid, fetch from DB and update.
	stats, err := h.getProtocolStatsFn(r.Context())
	if err != nil {
		h.statsMu.Unlock()
		http.Error(w, fmt.Sprintf("failed to retrieve protocol stats: %s", err.Error()), http.StatusInternalServerError)
		return
	}

	h.statsData = stats
	h.statsCached = time.Now()
	h.statsMu.Unlock()

	writeJSON(w, http.StatusOK, stats)
}

// GET /pool/stats
func (h *APIHandler) HandleGetPoolStats(w http.ResponseWriter, r *http.Request) {
	stats, err := h.getPoolStatsFn(r.Context())
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to retrieve pool statistics: %s", err.Error()), http.StatusInternalServerError)
		return
	}

	if stats == nil {
		stats = &db.DbPoolStats{
			TotalDeposits:         "0",
			TotalFunded:           "0",
			AvailableLiquidity:    "0",
			UtilizationRateBps:    0,
			TotalYieldDistributed: "0",
			ActiveInvoiceCount:    0,
			UpdatedAt:             time.Now(),
		}
	}

	writeJSON(w, http.StatusOK, stats)
}

// GET /events
func (h *APIHandler) HandleGetEvents(w http.ResponseWriter, r *http.Request) {
	limitStr := r.URL.Query().Get("limit")
	limit := 20
	if limitStr != "" {
		if parsed, err := strconv.Atoi(limitStr); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	events, err := h.getRecentEventsFn(r.Context(), limit)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to retrieve events: %s", err.Error()), http.StatusInternalServerError)
		return
	}

	if events == nil {
		events = []*db.EventLog{}
	}

	writeJSON(w, http.StatusOK, events)
}

// GET /pool/position/{address}
func (h *APIHandler) HandleGetLPPosition(w http.ResponseWriter, r *http.Request) {
	address := chi.URLParam(r, "address")
	if address == "" {
		http.Error(w, "missing address parameter", http.StatusBadRequest)
		return
	}

	if _, err := keypair.Parse(address); err != nil {
		http.Error(w, "invalid address format", http.StatusBadRequest)
		return
	}

	addrVal, err := soroban.MakeAddressScVal(address)
	if err != nil {
		http.Error(w, "failed to build address ScVal", http.StatusInternalServerError)
		return
	}

	scValResult, err := h.readContractFn(r.Context(), h.cfg.SorobanRPCURL, h.cfg.PoolContractID, "get_lp_position", []xdr.ScVal{addrVal}, h.serverKP)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to read LP position from pool: %s", err.Error()), http.StatusInternalServerError)
		return
	}

	shares := "0"
	usdcValue := "0"
	yieldEarned := "0"
	depositCount := 0

	if val, ok := xdrutil.GetMapVal(scValResult, "shares"); ok {
		shares = xdrutil.ParseU128(val)
	}
	if val, ok := xdrutil.GetMapVal(scValResult, "usdc_value"); ok {
		usdcValue = xdrutil.ParseU128(val)
	}
	if val, ok := xdrutil.GetMapVal(scValResult, "yield_earned"); ok {
		yieldEarned = xdrutil.ParseU128(val)
	}
	if val, ok := xdrutil.GetMapVal(scValResult, "deposit_count"); ok {
		depositCount = int(xdrutil.ParseU32(val))
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"shares":        shares,
		"usdc_value":    usdcValue,
		"yield_earned":  yieldEarned,
		"deposit_count": depositCount,
	})
}
