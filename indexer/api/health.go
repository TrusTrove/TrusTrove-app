package api

import (
	"net/http"
)

type ListenerHealth struct {
	MetricsEnabled bool
}

func (h *APIHandler) HandleHealth(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("OK"))
}
