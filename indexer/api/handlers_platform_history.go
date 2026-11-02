package api

import (
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/stellar/go-stellar-sdk/strkey"
)

func (h *APIHandler) HandleGetInvoicesByDocumentHash(w http.ResponseWriter, r *http.Request) {
	documentHash := chi.URLParam(r, "hash")
	if !documentHashPattern.MatchString(documentHash) {
		http.Error(w, "invalid document hash: must be 64 lowercase hexadecimal characters without a 0x prefix", http.StatusBadRequest)
		return
	}

	ids, err := h.getInvoiceIDsByDocumentHashFn(r.Context(), documentHash)
	if err != nil {
		internalError(w, r, "failed to get invoices by document hash", err)
		return
	}
	for i, id := range ids {
		if !strings.HasPrefix(id, "0x") {
			ids[i] = "0x" + id
		}
	}
	writeJSON(w, http.StatusOK, map[string][]string{"invoiceIds": ids})
}

func (h *APIHandler) HandleGetPartyHistory(w http.ResponseWriter, r *http.Request) {
	address := chi.URLParam(r, "address")
	decoded, err := strkey.Decode(strkey.VersionByteAccountID, address)
	if err != nil || len(decoded) != 32 {
		http.Error(w, "invalid Stellar account address", http.StatusBadRequest)
		return
	}

	history, err := h.getPartyHistoryFn(r.Context(), address, time.Now().Unix())
	if err != nil {
		internalError(w, r, "failed to get party history", err)
		return
	}
	writeJSON(w, http.StatusOK, history)
}
