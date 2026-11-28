package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"github.com/go-chi/chi/v5"
)

type BuyerSummary struct {
	ConfirmedTotal string `json:"confirmedTotal"`
	DueSoonTotal   string `json:"dueSoonTotal"`
	OverdueTotal   string `json:"overdueTotal"`
	RepaidTotal    string `json:"repaidTotal"`
}

func HandleBuyerSummary(w http.ResponseWriter, r *http.Request) {
	buyer := chi.URLParam(r, "buyer")
	if buyer == "" {
		http.Error(w, "Missing buyer parameter", http.StatusBadRequest)
		return
	}
	summary := BuyerSummary{
		ConfirmedTotal: "0.00",
		DueSoonTotal:   "0.00",
		OverdueTotal:   "0.00",
		RepaidTotal:    "0.00",
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(summary)
}

func HandleListInvoices(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	fromStr := query.Get("from")
	toStr := query.Get("to")

	if fromStr != "" && toStr != "" {
		from, err1 := strconv.ParseInt(fromStr, 10, 64)
		to, err2 := strconv.ParseInt(toStr, 10, 64)
		if err1 != nil || err2 != nil {
			http.Error(w, "Invalid date parameters", http.StatusBadRequest)
			return
		}
		if from > to {
			http.Error(w, "Inverted date window", http.StatusBadRequest)
			return
		}
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte("[]"))
}
