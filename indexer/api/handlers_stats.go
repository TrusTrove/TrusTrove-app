package api

import (
	"context"
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
	stats, err := h.statsCache.GetOrUpdate(r.Context(), h.getProtocolStatsFn)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to retrieve protocol stats: %s", err.Error()), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

// GET /pool/stats
func (h *APIHandler) HandleGetPoolStats(w http.ResponseWriter, r *http.Request) {
	stats, err := h.poolStatsCache.GetOrUpdate(r.Context(), func(ctx context.Context) (*db.DbPoolStats, error) {
		s, err := h.getPoolStatsFn(ctx)
		if err != nil {
			return nil, err
		}
		if s == nil {
			s = &db.DbPoolStats{
				TotalDeposits:         "0",
				TotalFunded:           "0",
				AvailableLiquidity:    "0",
				UtilizationRateBps:    0,
				TotalYieldDistributed: "0",
				ActiveInvoiceCount:    0,
				UpdatedAt:             time.Now(),
			}
		}
		return s, nil
	})
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to retrieve pool statistics: %s", err.Error()), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

// GET /events
func (h *APIHandler) HandleGetEvents(w http.ResponseWriter, r *http.Request) {
	limitStr := r.URL.Query().Get("limit")
	limit := 20
	isDefaultLimit := false
	if limitStr != "" {
		if parsed, err := strconv.Atoi(limitStr); err == nil && parsed > 0 {
			limit = parsed
		}
	} else {
		isDefaultLimit = true
	}

	var events []*db.EventLog
	var err error

	// Cache is only applied for the common no-filter/default-limit case.
	// We don't cache per-address lookups or custom limit requests because
	// they create unbounded cardinality in the cache keys, which would either
	// require a more complex LRU cache or risk unbounded memory growth, and
	// they are less frequently accessed than the global dashboard feeds.
	if isDefaultLimit {
		events, err = h.eventsCache.GetOrUpdate(r.Context(), func(ctx context.Context) ([]*db.EventLog, error) {
			evs, err := h.getRecentEventsFn(ctx, 20)
			if err != nil {
				return nil, err
			}
			if evs == nil {
				return []*db.EventLog{}, nil
			}
			return evs, nil
		})
	} else {
		events, err = h.getRecentEventsFn(r.Context(), limit)
		if events == nil {
			events = []*db.EventLog{}
		}
	}

	if err != nil {
		http.Error(w, fmt.Sprintf("failed to retrieve events: %s", err.Error()), http.StatusInternalServerError)
		return
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
