package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"trusttrove/indexer/db"

	"github.com/go-chi/chi/v5"
)

const validHistoryAddress = "GBA3B74YLHZPDBAEWQMN7JV6SNM6O245JJJQXSLIEDNUGEJ6YCJS5RZ6"

func requestWithURLParam(method, target, key, value string) *http.Request {
	req := httptest.NewRequest(method, target, nil)
	routeCtx := chi.NewRouteContext()
	routeCtx.URLParams.Add(key, value)
	return req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, routeCtx))
}

func TestHandleGetInvoicesByDocumentHash(t *testing.T) {
	hash := "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

	t.Run("found including duplicates", func(t *testing.T) {
		h := &APIHandler{getInvoiceIDsByDocumentHashFn: func(_ context.Context, got string) ([]string, error) {
			if got != hash {
				t.Fatalf("hash = %q", got)
			}
			return []string{"11", "0x22"}, nil
		}}
		rr := httptest.NewRecorder()
		h.HandleGetInvoicesByDocumentHash(rr, requestWithURLParam(http.MethodGet, "/", "hash", hash))

		if rr.Code != http.StatusOK {
			t.Fatalf("status = %d, body = %s", rr.Code, rr.Body.String())
		}
		var body struct {
			InvoiceIDs []string `json:"invoiceIds"`
		}
		if err := json.NewDecoder(rr.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if len(body.InvoiceIDs) != 2 || body.InvoiceIDs[0] != "0x11" || body.InvoiceIDs[1] != "0x22" {
			t.Fatalf("invoiceIds = %#v", body.InvoiceIDs)
		}
	})

	t.Run("not found is an empty 200", func(t *testing.T) {
		h := &APIHandler{getInvoiceIDsByDocumentHashFn: func(context.Context, string) ([]string, error) {
			return []string{}, nil
		}}
		rr := httptest.NewRecorder()
		h.HandleGetInvoicesByDocumentHash(rr, requestWithURLParam(http.MethodGet, "/", "hash", hash))
		if rr.Code != http.StatusOK || rr.Body.String() != "{\"invoiceIds\":[]}\n" {
			t.Fatalf("status = %d, body = %s", rr.Code, rr.Body.String())
		}
	})

	for _, malformed := range []string{"not-a-hash", "0x" + hash, "AB" + hash[2:]} {
		t.Run("malformed "+malformed[:2], func(t *testing.T) {
			h := &APIHandler{}
			rr := httptest.NewRecorder()
			h.HandleGetInvoicesByDocumentHash(rr, requestWithURLParam(http.MethodGet, "/", "hash", malformed))
			if rr.Code != http.StatusBadRequest {
				t.Fatalf("status = %d", rr.Code)
			}
		})
	}
}

func TestHandleGetPartyHistory(t *testing.T) {
	t.Run("history matches client schema", func(t *testing.T) {
		average := 2.5
		h := &APIHandler{getPartyHistoryFn: func(_ context.Context, address string, now int64) (*db.PartyHistory, error) {
			if address != validHistoryAddress || now <= 0 {
				t.Fatalf("address=%q now=%d", address, now)
			}
			return &db.PartyHistory{Address: address, TotalInvoices: 4, RepaidInvoices: 2, DefaultedInvoices: 1, LateInvoices: 1, AverageDaysLate: &average}, nil
		}}
		rr := httptest.NewRecorder()
		h.HandleGetPartyHistory(rr, requestWithURLParam(http.MethodGet, "/", "address", validHistoryAddress))
		if rr.Code != http.StatusOK {
			t.Fatalf("status = %d, body = %s", rr.Code, rr.Body.String())
		}
		var body map[string]any
		if err := json.NewDecoder(rr.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		for _, field := range []string{"address", "totalInvoices", "repaidInvoices", "defaultedInvoices", "lateInvoices", "averageDaysLate"} {
			if _, ok := body[field]; !ok {
				t.Errorf("missing field %s", field)
			}
		}
	})

	t.Run("empty party is an empty 200 object", func(t *testing.T) {
		h := &APIHandler{getPartyHistoryFn: func(_ context.Context, address string, _ int64) (*db.PartyHistory, error) {
			return &db.PartyHistory{Address: address}, nil
		}}
		rr := httptest.NewRecorder()
		h.HandleGetPartyHistory(rr, requestWithURLParam(http.MethodGet, "/", "address", validHistoryAddress))
		if rr.Code != http.StatusOK {
			t.Fatalf("status = %d", rr.Code)
		}
		var body db.PartyHistory
		if err := json.NewDecoder(rr.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if body.TotalInvoices != 0 || body.AverageDaysLate != nil {
			t.Fatalf("body = %#v", body)
		}
	})

	t.Run("invalid address", func(t *testing.T) {
		h := &APIHandler{}
		rr := httptest.NewRecorder()
		h.HandleGetPartyHistory(rr, requestWithURLParam(http.MethodGet, "/", "address", "not-an-address"))
		if rr.Code != http.StatusBadRequest {
			t.Fatalf("status = %d", rr.Code)
		}
	})
}
