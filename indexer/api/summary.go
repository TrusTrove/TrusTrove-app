package api

import (
	"net/http"
	"time"

	"trusttrove/indexer/db"

	"github.com/go-chi/chi/v5"
	"github.com/stellar/go-stellar-sdk/strkey"
)

// HandleGetBuyerInvoiceSummary serves GET /buyers/{address}/invoice-summary.
func (h *APIHandler) HandleGetBuyerInvoiceSummary(w http.ResponseWriter, r *http.Request) {
	address := chi.URLParam(r, "address")
	if address == "" {
		http.Error(w, "missing buyer address", http.StatusBadRequest)
		return
	}

	if !strkey.IsValidEd25519PublicKey(address) {
		http.Error(w, "invalid buyer address", http.StatusBadRequest)
		return
	}

	now := time.Now().Unix()
	summary, err := db.GetBuyerInvoiceSummary(r.Context(), address, now)
	if err != nil {
		internalError(w, r, "failed to retrieve buyer invoice summary", err)
		return
	}

	writeJSON(w, http.StatusOK, summary)
}
