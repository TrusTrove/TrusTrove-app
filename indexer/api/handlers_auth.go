package api

import (
	"encoding/json"
	"fmt"
	"net/http"

	"trusttrove/indexer/auth"

	"github.com/stellar/go-stellar-sdk/keypair"
)

// GET /auth
func (h *APIHandler) HandleGetAuth(w http.ResponseWriter, r *http.Request) {
	address := r.URL.Query().Get("address")
	if address == "" {
		http.Error(w, "missing address parameter", http.StatusBadRequest)
		return
	}

	_, err := keypair.Parse(address)
	if err != nil {
		http.Error(w, "invalid address format", http.StatusBadRequest)
		return
	}

	xdrString, err := auth.GenerateChallenge(h.serverKP, address, h.cfg.NetworkPassphrase)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to generate challenge: %s", err.Error()), http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"transaction":        xdrString,
		"network_passphrase": h.cfg.NetworkPassphrase,
	})
}

// POST /auth
func (h *APIHandler) HandlePostAuth(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Transaction string `json:"transaction"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if body.Transaction == "" {
		http.Error(w, "missing transaction parameter", http.StatusBadRequest)
		return
	}

	clientAddr, err := auth.VerifyChallenge(body.Transaction, h.serverKP, h.cfg.NetworkPassphrase)
	if err != nil {
		http.Error(w, fmt.Sprintf("challenge verification failed: %s", err.Error()), http.StatusUnauthorized)
		return
	}

	token, err := auth.GenerateJWT(clientAddr, h.cfg.JWTSecret, h.cfg.JWTExpiryHours)
	if err != nil {
		http.Error(w, "failed to generate authentication token", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"token": token,
	})
}
