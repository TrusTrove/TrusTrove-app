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

// responseCacheTTL is how long a cached /events or /pool/stats response stays
// fresh. It matches the 30s window HandleGetStats already applies to /stats, so
// every TTL-cached read endpoint in the API expires on the same clock (#1078).
const responseCacheTTL = 30 * time.Second

// poolStatsCacheKey keys the single /pool/stats entry in h.respCache. Events are
// keyed per (limit, issuer) because both change the response, so one caller's
// filtered feed can never be served to another caller (#1078).
const poolStatsCacheKey = "pool:stats"

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
		// The raw DB error can disclose table/column names; log it and return
		// a generic message (issue #921).
		internalError(w, r, "failed to retrieve protocol stats", err)
		return
	}

	h.statsData = stats
	h.statsCached = time.Now()
	h.statsMu.Unlock()

	writeJSON(w, http.StatusOK, stats)
}

// GET /pool/stats
func (h *APIHandler) HandleGetPoolStats(w http.ResponseWriter, r *http.Request) {
	// The aggregate is the sum of every pool row, so it is identical for every
	// caller: one cache entry, keyed by nothing but the route (#1078).
	if cached, ok := h.respCache.Get(poolStatsCacheKey); ok {
		if stats, ok := cached.(*db.DbPoolStats); ok {
			writeJSON(w, http.StatusOK, stats)
			return
		}
	}

	stats, err := h.getPoolStatsFn(r.Context())
	if err != nil {
		// The raw DB error can disclose table/column names; log it and return
		// a generic message (issue #921). Failures are never cached, so a
		// transient error cannot pin a 500 in front of the pool page for a TTL.
		internalError(w, r, "failed to retrieve pool statistics", err)
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

	h.respCache.Set(poolStatsCacheKey, stats, responseCacheTTL)
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

	// Optional issuer filter restricts the feed to events on that account's own
	// invoices, which is what the SME dashboard needs (issue #1115). An empty
	// value keeps the protocol-wide behaviour every other consumer relies on.
	issuer := r.URL.Query().Get("issuer")
	if issuer != "" {
		if _, err := keypair.Parse(issuer); err != nil {
			http.Error(w, "invalid issuer parameter: must be a Stellar account address", http.StatusBadRequest)
			return
		}
	}

	// Both the page size and the optional issuer change the response, so the
	// feed is cached per query and one caller's slice is never served to
	// another (#1078).
	cacheKey := fmt.Sprintf("events:%d:%s", limit, issuer)
	if cached, ok := h.respCache.Get(cacheKey); ok {
		if events, ok := cached.([]*db.EventLog); ok {
			writeJSON(w, http.StatusOK, events)
			return
		}
	}

	events, err := h.getRecentEventsFn(r.Context(), limit, issuer)
	if err != nil {
		// The raw DB error can disclose table/column names; log it and return
		// a generic message (issue #921). Errors are never cached (#1078).
		internalError(w, r, "failed to retrieve events", err)
		return
	}

	if events == nil {
		events = []*db.EventLog{}
	}

	h.respCache.Set(cacheKey, events, responseCacheTTL)
	writeJSON(w, http.StatusOK, events)
}

// GET /pool/snapshots
func (h *APIHandler) HandleGetPoolSnapshots(w http.ResponseWriter, r *http.Request) {
	limit := 100
	if s := r.URL.Query().Get("limit"); s != "" {
		if parsed, err := strconv.Atoi(s); err == nil && parsed > 0 && parsed <= 500 {
			limit = parsed
		}
	}

	history, err := h.getPoolSnapshotsFn(r.Context(), limit)
	if err != nil {
		internalError(w, r, "failed to retrieve pool snapshots", err)
		return
	}

	// Response shape matches apps/web/types/index.ts PoolSnapshot:
	// { timestamp, utilizationRateBps, totalYieldDistributed }
	type poolSnapshot struct {
		Timestamp             int64  `json:"timestamp"`
		UtilizationRateBps    int    `json:"utilizationRateBps"`
		TotalYieldDistributed string `json:"totalYieldDistributed"`
	}

	snapshots := make([]poolSnapshot, 0, len(history))
	for _, h := range history {
		snapshots = append(snapshots, poolSnapshot{
			Timestamp:             h.RecordedAt,
			UtilizationRateBps:    h.UtilizationRateBps,
			TotalYieldDistributed: h.TotalYieldDistributed,
		})
	}

	writeJSON(w, http.StatusOK, snapshots)
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
		// The RPC error can embed the full RPC URL (and any API key in it);
		// log it and return a generic message (issue #921).
		internalError(w, r, "failed to read LP position from pool", err)
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
