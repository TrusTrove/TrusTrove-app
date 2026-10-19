package api

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"trusttrove/indexer/db"

	"github.com/stellar/go-stellar-sdk/keypair"
)

// These tests cover issue #1078: TTLCache.NewTTLCache/Set/Get existed with no
// callers, so /events and /pool/stats re-queried the database on every request
// while the API advertised a TTL response cache. Each test counts how often the
// injected reader runs, which is the only observable difference between a
// handler that consults the cache and one that does not.

func TestHandleGetEvents_IdenticalRequestsQueryOnce(t *testing.T) {
	h := readonlyTestHandler(t)
	calls := 0
	h.getRecentEventsFn = func(_ context.Context, limit int, _ string) ([]*db.EventLog, error) {
		calls++
		return []*db.EventLog{{ID: 1, EventType: "InvoiceFunded", Ledger: 100}}, nil
	}

	var bodies []string
	for i := 0; i < 3; i++ {
		rr := httptest.NewRecorder()
		h.HandleGetEvents(rr, httptest.NewRequest(http.MethodGet, "/events?limit=6", nil))
		if rr.Code != http.StatusOK {
			t.Fatalf("iter %d: expected 200, got %d body %q", i, rr.Code, rr.Body.String())
		}
		bodies = append(bodies, rr.Body.String())
	}

	if calls != 1 {
		t.Errorf("expected the reader to run exactly once across 3 identical requests, got %d", calls)
	}
	for i, b := range bodies {
		if b != bodies[0] {
			t.Errorf("iter %d: expected the cached body to match the first response, got %q vs %q", i, b, bodies[0])
		}
	}
}

// TestHandleGetEvents_QueryIsPartOfTheCacheKey is the safety half of #1078: a
// cache that ignored limit or issuer would answer one caller's request with
// another caller's feed.
func TestHandleGetEvents_QueryIsPartOfTheCacheKey(t *testing.T) {
	h := readonlyTestHandler(t)
	issuerKP, err := keypair.Random()
	if err != nil {
		t.Fatalf("generate issuer keypair: %v", err)
	}
	kp := issuerKP.Address()

	type seen struct {
		limit  int
		issuer string
	}
	var calls []seen
	h.getRecentEventsFn = func(_ context.Context, limit int, issuer string) ([]*db.EventLog, error) {
		calls = append(calls, seen{limit, issuer})
		return []*db.EventLog{}, nil
	}

	for _, target := range []string{
		"/events?limit=6",
		"/events?limit=6",
		"/events?limit=10",
		"/events?limit=6&issuer=" + kp,
	} {
		rr := httptest.NewRecorder()
		h.HandleGetEvents(rr, httptest.NewRequest(http.MethodGet, target, nil))
		if rr.Code != http.StatusOK {
			t.Fatalf("%s: expected 200, got %d", target, rr.Code)
		}
	}

	if len(calls) != 3 {
		t.Fatalf("expected 3 reader calls for 3 distinct queries, got %d: %+v", len(calls), calls)
	}
	if calls[0] != (seen{6, ""}) || calls[1] != (seen{10, ""}) || calls[2].limit != 6 || calls[2].issuer != kp {
		t.Errorf("unexpected reader arguments: %+v", calls)
	}
}

func TestHandleGetEvents_EmptyResultIsCached(t *testing.T) {
	h := readonlyTestHandler(t)
	calls := 0
	h.getRecentEventsFn = func(_ context.Context, _ int, _ string) ([]*db.EventLog, error) {
		calls++
		// The store returns nil for a protocol with no events yet; the handler
		// normalises it to [] so clients always get an array (#1078 keeps that).
		return nil, nil
	}

	for i := 0; i < 2; i++ {
		rr := httptest.NewRecorder()
		h.HandleGetEvents(rr, httptest.NewRequest(http.MethodGet, "/events", nil))
		if got := strings.TrimSpace(rr.Body.String()); got != "[]" {
			t.Fatalf("iter %d: expected an empty array, got %q", i, got)
		}
	}

	if calls != 1 {
		t.Errorf("expected the normalised empty result to be cached, reader ran %d times", calls)
	}
}

func TestHandleGetEvents_ErrorIsNotCached(t *testing.T) {
	h := readonlyTestHandler(t)
	calls := 0
	h.getRecentEventsFn = func(_ context.Context, _ int, _ string) ([]*db.EventLog, error) {
		calls++
		if calls == 1 {
			return nil, errors.New("events query failed")
		}
		return []*db.EventLog{{ID: 2, EventType: "InvoiceCreated"}}, nil
	}

	first := httptest.NewRecorder()
	h.HandleGetEvents(first, httptest.NewRequest(http.MethodGet, "/events", nil))
	if first.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 on the failing read, got %d", first.Code)
	}

	second := httptest.NewRecorder()
	h.HandleGetEvents(second, httptest.NewRequest(http.MethodGet, "/events", nil))
	if second.Code != http.StatusOK {
		t.Fatalf("expected the retry to re-read and succeed, got %d", second.Code)
	}
	if calls != 2 {
		t.Errorf("expected 2 reader calls (a 500 must not be cached), got %d", calls)
	}
}

func TestHandleGetPoolStats_IdenticalRequestsQueryOnce(t *testing.T) {
	h := readonlyTestHandler(t)
	calls := 0
	h.getPoolStatsFn = func(_ context.Context) (*db.DbPoolStats, error) {
		calls++
		return &db.DbPoolStats{TotalDeposits: "1000", AvailableLiquidity: "400", UtilizationRateBps: 6000}, nil
	}

	var bodies []string
	for i := 0; i < 3; i++ {
		rr := httptest.NewRecorder()
		h.HandleGetPoolStats(rr, httptest.NewRequest(http.MethodGet, "/pool/stats", nil))
		if rr.Code != http.StatusOK {
			t.Fatalf("iter %d: expected 200, got %d body %q", i, rr.Code, rr.Body.String())
		}
		bodies = append(bodies, rr.Body.String())
	}

	if calls != 1 {
		t.Errorf("expected the reader to run exactly once across 3 identical requests, got %d", calls)
	}
	if bodies[1] != bodies[0] || bodies[2] != bodies[0] {
		t.Error("expected every cached response to match the first")
	}
}

func TestHandleGetPoolStats_ErrorIsNotCached(t *testing.T) {
	h := readonlyTestHandler(t)
	calls := 0
	h.getPoolStatsFn = func(_ context.Context) (*db.DbPoolStats, error) {
		calls++
		if calls == 1 {
			return nil, errors.New("pool stats query failed")
		}
		return &db.DbPoolStats{TotalDeposits: "7"}, nil
	}

	first := httptest.NewRecorder()
	h.HandleGetPoolStats(first, httptest.NewRequest(http.MethodGet, "/pool/stats", nil))
	if first.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 on the failing read, got %d", first.Code)
	}

	second := httptest.NewRecorder()
	h.HandleGetPoolStats(second, httptest.NewRequest(http.MethodGet, "/pool/stats", nil))
	if second.Code != http.StatusOK {
		t.Fatalf("expected the retry to re-read and succeed, got %d", second.Code)
	}
	if calls != 2 {
		t.Errorf("expected 2 reader calls (a 500 must not be cached), got %d", calls)
	}
}
