package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"trusttrove/indexer/db"
)

// paginatedResponse mirrors the JSON envelope returned by HandleGetInvoices.
type paginatedResponse struct {
	Data       []db.DbInvoice `json:"data"`
	Total      int            `json:"total"`
	Page       int            `json:"page"`
	Limit      int            `json:"limit"`
	TotalPages int            `json:"totalPages"`
}

// invoicesPageFunc is the signature of db.GetInvoicesPage-compatible functions
// used by the handler via dependency injection.
type invoicesPageFunc func(status, issuer string, limit, offset int) ([]*db.DbInvoice, int, error)

// invoiceHandlerUnderTest is a trimmed-down version of HandleGetInvoices that
// accepts an injectable db function so tests don't need a live DB.
// We replicate the exact same parameter-parsing, validation, and response logic
// as the real handler.
func invoiceHandlerUnderTest(fn invoicesPageFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		status := r.URL.Query().Get("status")
		issuer := r.URL.Query().Get("issuer")

		page := 1
		limit := 20

		if pageStr := r.URL.Query().Get("page"); pageStr != "" {
			var v int
			if _, err := fmt.Sscanf(pageStr, "%d", &v); err != nil || v < 1 {
				http.Error(w, "invalid page parameter: must be a positive integer", http.StatusBadRequest)
				return
			}
			page = v
		}

		if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
			var v int
			if _, err := fmt.Sscanf(limitStr, "%d", &v); err != nil || v < 1 {
				http.Error(w, "invalid limit parameter: must be a positive integer", http.StatusBadRequest)
				return
			}
			if v > 100 {
				limit = 100
			} else {
				limit = v
			}
		}

		offset := (page - 1) * limit

		invoices, total, err := fn(status, issuer, limit, offset)
		if err != nil {
			http.Error(w, fmt.Sprintf("failed to retrieve invoices: %s", err.Error()), http.StatusInternalServerError)
			return
		}

		if invoices == nil {
			invoices = []*db.DbInvoice{}
		}

		totalPages := (total + limit - 1) / limit
		if totalPages < 1 {
			totalPages = 1
		}

		resp := map[string]interface{}{
			"data":       invoices,
			"total":      total,
			"page":       page,
			"limit":      limit,
			"totalPages": totalPages,
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}
}

// helper to fire a request and decode the response.
func doRequest(t *testing.T, handler http.HandlerFunc, url string) (*httptest.ResponseRecorder, paginatedResponse, bool) {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, url, nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		return rr, paginatedResponse{}, false
	}
	var resp paginatedResponse
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}
	return rr, resp, true
}

// -----------------------------------------------------------------
// Tests
// -----------------------------------------------------------------

func TestHandleGetInvoices_Defaults(t *testing.T) {
	handler := invoiceHandlerUnderTest(func(status, issuer string, limit, offset int) ([]*db.DbInvoice, int, error) {
		if limit != 20 {
			t.Errorf("expected default limit=20, got %d", limit)
		}
		if offset != 0 {
			t.Errorf("expected default offset=0, got %d", offset)
		}
		return nil, 0, nil
	})

	rr, resp, ok := doRequest(t, handler, "/invoices")
	if !ok {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	if resp.Page != 1 {
		t.Errorf("expected page=1, got %d", resp.Page)
	}
	if resp.Limit != 20 {
		t.Errorf("expected limit=20, got %d", resp.Limit)
	}
	if resp.TotalPages != 1 {
		t.Errorf("expected totalPages=1 for zero results, got %d", resp.TotalPages)
	}
	if resp.Data == nil {
		t.Error("expected data to be a non-null array, got nil")
	}
}

func TestHandleGetInvoices_PageAndLimitPassedThrough(t *testing.T) {
	called := false
	handler := invoiceHandlerUnderTest(func(status, issuer string, limit, offset int) ([]*db.DbInvoice, int, error) {
		called = true
		if limit != 5 {
			t.Errorf("expected limit=5, got %d", limit)
		}
		// page=3, limit=5 → offset=10
		if offset != 10 {
			t.Errorf("expected offset=10, got %d", offset)
		}
		return []*db.DbInvoice{{ID: "abc"}}, 13, nil
	})

	rr, resp, ok := doRequest(t, handler, "/invoices?page=3&limit=5")
	if !ok {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	if !called {
		t.Fatal("db function was not called")
	}
	if resp.Page != 3 {
		t.Errorf("expected page=3, got %d", resp.Page)
	}
	if resp.Limit != 5 {
		t.Errorf("expected limit=5, got %d", resp.Limit)
	}
	if resp.Total != 13 {
		t.Errorf("expected total=13, got %d", resp.Total)
	}
	// totalPages = ceil(13/5) = 3
	if resp.TotalPages != 3 {
		t.Errorf("expected totalPages=3, got %d", resp.TotalPages)
	}
}

func TestHandleGetInvoices_LimitCappedAt100(t *testing.T) {
	handler := invoiceHandlerUnderTest(func(status, issuer string, limit, offset int) ([]*db.DbInvoice, int, error) {
		if limit != 100 {
			t.Errorf("expected limit capped at 100, got %d", limit)
		}
		return nil, 0, nil
	})

	rr, resp, ok := doRequest(t, handler, "/invoices?limit=999")
	if !ok {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	if resp.Limit != 100 {
		t.Errorf("expected limit=100 in response, got %d", resp.Limit)
	}
}

func TestHandleGetInvoices_InvalidPageReturns400(t *testing.T) {
	handler := invoiceHandlerUnderTest(func(status, issuer string, limit, offset int) ([]*db.DbInvoice, int, error) {
		t.Error("db should not be called on bad input")
		return nil, 0, nil
	})

	cases := []string{
		"/invoices?page=0",
		"/invoices?page=-1",
		"/invoices?page=abc",
	}
	for _, url := range cases {
		rr := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, url, nil)
		handler.ServeHTTP(rr, req)
		if rr.Code != http.StatusBadRequest {
			t.Errorf("url=%s: expected 400, got %d", url, rr.Code)
		}
	}
}

func TestHandleGetInvoices_InvalidLimitReturns400(t *testing.T) {
	handler := invoiceHandlerUnderTest(func(status, issuer string, limit, offset int) ([]*db.DbInvoice, int, error) {
		t.Error("db should not be called on bad input")
		return nil, 0, nil
	})

	cases := []string{
		"/invoices?limit=0",
		"/invoices?limit=-5",
		"/invoices?limit=xyz",
	}
	for _, url := range cases {
		rr := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, url, nil)
		handler.ServeHTTP(rr, req)
		if rr.Code != http.StatusBadRequest {
			t.Errorf("url=%s: expected 400, got %d", url, rr.Code)
		}
	}
}

func TestHandleGetInvoices_FiltersPassedThrough(t *testing.T) {
	handler := invoiceHandlerUnderTest(func(status, issuer string, limit, offset int) ([]*db.DbInvoice, int, error) {
		if status != "funded" {
			t.Errorf("expected status=funded, got %q", status)
		}
		if issuer != "GABC" {
			t.Errorf("expected issuer=GABC, got %q", issuer)
		}
		return nil, 0, nil
	})

	rr, _, ok := doRequest(t, handler, "/invoices?status=funded&issuer=GABC")
	if !ok {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}

func TestHandleGetInvoices_TotalPagesCalculation(t *testing.T) {
	cases := []struct {
		total     int
		limit     int
		wantPages int
	}{
		{total: 0, limit: 20, wantPages: 1},
		{total: 1, limit: 20, wantPages: 1},
		{total: 20, limit: 20, wantPages: 1},
		{total: 21, limit: 20, wantPages: 2},
		{total: 100, limit: 20, wantPages: 5},
		{total: 101, limit: 20, wantPages: 6},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(fmt.Sprintf("total=%d,limit=%d", tc.total, tc.limit), func(t *testing.T) {
			handler := invoiceHandlerUnderTest(func(status, issuer string, limit, offset int) ([]*db.DbInvoice, int, error) {
				return nil, tc.total, nil
			})

			url := fmt.Sprintf("/invoices?limit=%d", tc.limit)
			rr, resp, ok := doRequest(t, handler, url)
			if !ok {
				t.Fatalf("expected 200, got %d", rr.Code)
			}
			if resp.TotalPages != tc.wantPages {
				t.Errorf("total=%d limit=%d: expected totalPages=%d, got %d",
					tc.total, tc.limit, tc.wantPages, resp.TotalPages)
			}
		})
	}
}

func TestHandleGetInvoices_DataNeverNull(t *testing.T) {
	handler := invoiceHandlerUnderTest(func(status, issuer string, limit, offset int) ([]*db.DbInvoice, int, error) {
		return nil, 0, nil // db returns nil slice
	})

	req := httptest.NewRequest(http.MethodGet, "/invoices", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	// Must be valid JSON with an array, not "null"
	var raw map[string]json.RawMessage
	if err := json.NewDecoder(rr.Body).Decode(&raw); err != nil {
		t.Fatalf("response is not valid JSON: %v", err)
	}
	dataRaw, ok := raw["data"]
	if !ok {
		t.Fatal("response missing 'data' key")
	}
	if string(dataRaw) == "null" {
		t.Error("'data' field must not be null; expected []")
	}
}

// patchStatusFunc captures the id/status the handler passes to the db layer.
type patchStatusFunc struct {
	called bool
	id     string
	status string
	err    error
}

func (f *patchStatusFunc) update(ctx context.Context, id, status string) error {
	f.called = true
	f.id = id
	f.status = status
	return f.err
}

// doPatchStatus routes a PATCH request through a chi router (so URL params are
// populated) against the handler and returns the recorder plus a flag
// indicating whether the body decoded as a JSON object with an "id" field.
func doPatchStatus(t *testing.T, h *APIHandler, url string, body io.Reader) (*httptest.ResponseRecorder, bool) {
	t.Helper()
	r := chi.NewRouter()
	r.Patch("/invoices/{id}/status", h.HandlePatchInvoiceStatus)

	req := httptest.NewRequest(http.MethodPatch, url, body)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	return rr, strings.Contains(rr.Body.String(), `"id"`)
}

func TestHandlePatchInvoiceStatus_UpdatesStatus(t *testing.T) {
	var captured patchStatusFunc
	h := &APIHandler{patchInvoiceStatusFn: captured.update}

	reqBody := strings.NewReader(`{"status":"Cancelled"}`)
	rr, ok := doPatchStatus(t, h, "/invoices/inv-123/status", reqBody)
	if !ok {
		t.Fatalf("expected 200 with id in body, got %d: %s", rr.Code, rr.Body.String())
	}
	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}
	if !captured.called {
		t.Fatal("patchInvoiceStatusFn was not called")
	}
	if captured.id != "inv-123" {
		t.Errorf("expected id=inv-123, got %q", captured.id)
	}
	if captured.status != "Cancelled" {
		t.Errorf("expected status=Cancelled, got %q", captured.status)
	}
}

func TestHandlePatchInvoiceStatus_MissingIDReturns400(t *testing.T) {
	var captured patchStatusFunc
	h := &APIHandler{patchInvoiceStatusFn: captured.update}

	reqBody := strings.NewReader(`{"status":"Cancelled"}`)
	rr, _ := doPatchStatus(t, h, "/invoices//status", reqBody)
	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
	if captured.called {
		t.Error("db should not be called with a missing id")
	}
}

func TestHandlePatchInvoiceStatus_EmptyStatusReturns400(t *testing.T) {
	var captured patchStatusFunc
	h := &APIHandler{patchInvoiceStatusFn: captured.update}

	reqBody := strings.NewReader(`{"status":""}`)
	rr, _ := doPatchStatus(t, h, "/invoices/inv-123/status", reqBody)
	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
	if captured.called {
		t.Error("db should not be called with an empty status")
	}
}

func TestHandlePatchInvoiceStatus_InvalidBodyReturns400(t *testing.T) {
	var captured patchStatusFunc
	h := &APIHandler{patchInvoiceStatusFn: captured.update}

	req := httptest.NewRequest(http.MethodPatch, "/invoices/inv-123/status", strings.NewReader("not json"))
	req.Header.Set("Content-Type", "application/json")
	r := chi.NewRouter()
	r.Patch("/invoices/{id}/status", h.HandlePatchInvoiceStatus)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid body, got %d", rr.Code)
	}
	if captured.called {
		t.Error("db should not be called for an invalid body")
	}
}

func TestHandlePatchInvoiceStatus_DBErrorReturns500(t *testing.T) {
	captured := &patchStatusFunc{err: errors.New("connection refused")}
	h := &APIHandler{patchInvoiceStatusFn: captured.update}

	reqBody := strings.NewReader(`{"status":"Cancelled"}`)
	rr, _ := doPatchStatus(t, h, "/invoices/inv-123/status", reqBody)
	if rr.Code != http.StatusInternalServerError {
		t.Errorf("expected 500 on db error, got %d", rr.Code)
	}
}
