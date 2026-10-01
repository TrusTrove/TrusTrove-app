package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"trusttrove/indexer/db"
)

// ------------------------------------------------------------------
// HandleGetPoolSnapshots
// ------------------------------------------------------------------

func TestHandleGetPoolSnapshots_EmptyHistoryReturnsArray(t *testing.T) {
	h := readonlyTestHandler(t)
	h.getPoolSnapshotsFn = func(_ context.Context, limit int) ([]*db.PoolSnapshotHistory, error) {
		if limit != 100 {
			t.Errorf("expected default limit=100, got %d", limit)
		}
		return []*db.PoolSnapshotHistory{}, nil
	}

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/pool/snapshots", nil)
	h.HandleGetPoolSnapshots(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d; body: %s", rr.Code, rr.Body.String())
	}
	if rr.Body.String() != "[]\n" && rr.Body.String() != "[]" {
		t.Errorf("expected empty JSON array, got %q", rr.Body.String())
	}
	got := decodeJSON[[]*db.PoolSnapshotHistory](t, rr.Body.Bytes())
	if got == nil {
		t.Error("expected non-nil decoded slice")
	}
}

func TestHandleGetPoolSnapshots_NilResultReturnsEmptyArray(t *testing.T) {
	h := readonlyTestHandler(t)
	h.getPoolSnapshotsFn = func(_ context.Context, _ int) ([]*db.PoolSnapshotHistory, error) {
		return nil, nil
	}

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/pool/snapshots", nil)
	h.HandleGetPoolSnapshots(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d; body: %s", rr.Code, rr.Body.String())
	}
	if rr.Body.String() != "[]\n" && rr.Body.String() != "[]" {
		t.Errorf("expected [] not null for nil result, got %q", rr.Body.String())
	}
}

func TestHandleGetPoolSnapshots_ReturnsNewestFirst(t *testing.T) {
	h := readonlyTestHandler(t)
	want := []*db.PoolSnapshotHistory{
		{Timestamp: 1700000300, UtilizationRateBps: 7000, TotalYieldDistributed: "300"},
		{Timestamp: 1700000200, UtilizationRateBps: 6500, TotalYieldDistributed: "200"},
		{Timestamp: 1700000100, UtilizationRateBps: 5000, TotalYieldDistributed: "100"},
	}
	h.getPoolSnapshotsFn = func(_ context.Context, _ int) ([]*db.PoolSnapshotHistory, error) {
		return want, nil
	}

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/pool/snapshots", nil)
	h.HandleGetPoolSnapshots(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d; body: %s", rr.Code, rr.Body.String())
	}
	got := decodeJSON[[]*db.PoolSnapshotHistory](t, rr.Body.Bytes())
	if len(got) != 3 {
		t.Fatalf("expected 3 snapshots, got %d", len(got))
	}
	if got[0].Timestamp != 1700000300 || got[2].Timestamp != 1700000100 {
		t.Errorf("expected newest first, got timestamps %d, %d, %d",
			got[0].Timestamp, got[1].Timestamp, got[2].Timestamp)
	}
	// Response field names must match apps/web PoolSnapshot (camelCase).
	var list []map[string]json.RawMessage
	if err := json.Unmarshal(rr.Body.Bytes(), &list); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if _, ok := list[0]["timestamp"]; !ok {
		t.Errorf("expected camelCase field timestamp in response, got keys %v", keysOf(list[0]))
	}
	if _, ok := list[0]["utilizationRateBps"]; !ok {
		t.Errorf("expected camelCase field utilizationRateBps in response, got keys %v", keysOf(list[0]))
	}
	if _, ok := list[0]["totalYieldDistributed"]; !ok {
		t.Errorf("expected camelCase field totalYieldDistributed in response, got keys %v", keysOf(list[0]))
	}
}

func keysOf(m map[string]json.RawMessage) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

func TestHandleGetPoolSnapshots_LimitParameterForwarded(t *testing.T) {
	h := readonlyTestHandler(t)
	var capturedLimit int
	h.getPoolSnapshotsFn = func(_ context.Context, limit int) ([]*db.PoolSnapshotHistory, error) {
		capturedLimit = limit
		return []*db.PoolSnapshotHistory{}, nil
	}

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/pool/snapshots?limit=25", nil)
	h.HandleGetPoolSnapshots(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	if capturedLimit != 25 {
		t.Errorf("expected limit=25 to be forwarded, got %d", capturedLimit)
	}
}

func TestHandleGetPoolSnapshots_LimitClampedToMax(t *testing.T) {
	h := readonlyTestHandler(t)
	var capturedLimit int
	h.getPoolSnapshotsFn = func(_ context.Context, limit int) ([]*db.PoolSnapshotHistory, error) {
		capturedLimit = limit
		return []*db.PoolSnapshotHistory{}, nil
	}

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/pool/snapshots?limit=9999", nil)
	h.HandleGetPoolSnapshots(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	if capturedLimit != 500 {
		t.Errorf("expected limit clamped to 500, got %d", capturedLimit)
	}
}

func TestHandleGetPoolSnapshots_InvalidLimitFallsBackToDefault(t *testing.T) {
	h := readonlyTestHandler(t)
	var capturedLimit int
	h.getPoolSnapshotsFn = func(_ context.Context, limit int) ([]*db.PoolSnapshotHistory, error) {
		capturedLimit = limit
		return []*db.PoolSnapshotHistory{}, nil
	}

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/pool/snapshots?limit=not-a-number", nil)
	h.HandleGetPoolSnapshots(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	if capturedLimit != 100 {
		t.Errorf("expected invalid limit to fall back to default 100, got %d", capturedLimit)
	}
}

func TestHandleGetPoolSnapshots_DBErrorReturns500(t *testing.T) {
	h := readonlyTestHandler(t)
	h.getPoolSnapshotsFn = func(_ context.Context, _ int) ([]*db.PoolSnapshotHistory, error) {
		return nil, errors.New("connection refused")
	}

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/pool/snapshots", nil)
	h.HandleGetPoolSnapshots(rr, req)

	if rr.Code != http.StatusInternalServerError {
		t.Errorf("expected 500 on db error, got %d", rr.Code)
	}
}
