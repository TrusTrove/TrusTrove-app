package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"trusttrove/indexer/config"
	"trusttrove/indexer/db"
	"trusttrove/indexer/soroban"

	"github.com/stellar/go-stellar-sdk/keypair"
	"github.com/stellar/go-stellar-sdk/xdr"
)

type APIHandler struct {
	cfg             *config.Config
	serverKP        *keypair.Full
	statsMu         sync.RWMutex
	statsData       *db.ProtocolStats
	statsCached     time.Time
	listenerHealth  *ListenerHealth
	dbHealthChecker func(context.Context) error

	// dependency-injectable storage and contract readers. Defaults are wired
	// in NewAPIHandler so production behavior is unchanged; tests in this
	// package can override individual fields to avoid requiring a live DB
	// or Soroban RPC.
	getInvoiceByIDFn   func(context.Context, string) (*db.DbInvoice, error)
	getPoolStatsFn     func(context.Context) (*db.DbPoolStats, error)
	getRecentEventsFn  func(context.Context, int) ([]*db.EventLog, error)
	getProtocolStatsFn func(context.Context) (*db.ProtocolStats, error)
	readContractFn     func(ctx context.Context, rpcURL string, contractID string, method string, args []xdr.ScVal, serverKP *keypair.Full) (xdr.ScVal, error)
}

func NewAPIHandler(cfg *config.Config) (*APIHandler, error) {
	kp, err := GetServerKeypair(cfg.ServerSeed)
	if err != nil {
		return nil, fmt.Errorf("invalid server seed: %w", err)
	}
	return &APIHandler{
		cfg:                cfg,
		serverKP:           kp,
		listenerHealth:     NewListenerHealth(),
		dbHealthChecker:    defaultDBHealthChecker,
		getInvoiceByIDFn:   db.GetInvoiceByID,
		getPoolStatsFn:     db.GetPoolStats,
		getRecentEventsFn:  db.GetRecentEvents,
		getProtocolStatsFn: db.GetProtocolStats,
		readContractFn:     soroban.ReadContract,
	}, nil
}

func GetServerKeypair(seed string) (*keypair.Full, error) {
	if strings.TrimSpace(seed) == "" {
		return nil, fmt.Errorf("empty server seed")
	}
	return keypair.ParseFull(seed)
}

// writeJSON sets the Content-Type header, writes the status code, encodes v as
// JSON, and logs any encoding error at WARN level.
func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Warn("failed to encode JSON response", "error", err)
	}
}

// httpError pairs a client-facing message with the status code it should be
// served under. It lets the handler helpers in this package report failures
// without holding a http.ResponseWriter, which keeps them unit-testable.
type httpError struct {
	status  int
	message string
}

func (e *httpError) Error() string { return e.message }

// Status returns the HTTP status code this error should be served under.
func (e *httpError) Status() int { return e.status }

// httpErrorf builds an httpError with a formatted message.
func httpErrorf(status int, format string, args ...interface{}) *httpError {
	return &httpError{status: status, message: fmt.Sprintf(format, args...)}
}

// writeHTTPError serves err as a plain-text error response, using the status
// code carried by an *httpError and falling back to 500 for anything else.
func writeHTTPError(w http.ResponseWriter, err error) {
	var he *httpError
	if errors.As(err, &he) {
		http.Error(w, he.message, he.status)
		return
	}
	http.Error(w, err.Error(), http.StatusInternalServerError)
}

func (h *APIHandler) ListenerHealth() *ListenerHealth {
	if h.listenerHealth == nil {
		h.listenerHealth = NewListenerHealth()
	}
	return h.listenerHealth
}

func (h *APIHandler) CheckHealth(ctx context.Context) error {
	if h.dbHealthChecker != nil {
		if err := h.dbHealthChecker(ctx); err != nil {
			return fmt.Errorf("database health check failed: %w", err)
		}
	}
	if h.ListenerHealth() != nil && !h.ListenerHealth().IsHealthy() {
		return fmt.Errorf("listener is not healthy")
	}
	return nil
}
