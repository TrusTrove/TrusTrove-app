package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"trusttrove/indexer/db"

	"github.com/stellar/go-stellar-sdk/keypair"
)

func TestHandleGetBuyerInvoiceSummary_Validation(t *testing.T) {
	h := newTestHandler(t)
	buyer, err := keypair.Random()
	if err != nil {
		t.Fatalf("generate buyer keypair: %v", err)
	}

	tests := []struct {
		name       string
		address    string
		wantStatus int
	}{
		{
			name:       "valid buyer address",
			address:    buyer.Address(),
			wantStatus: http.StatusOK,
		},
		{
			name:       "invalid buyer address",
			address:    "not-a-valid-stellar-address",
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/buyers/"+tt.address+"/invoice-summary", nil)
			recorder := httptest.NewRecorder()

			h.HandleGetBuyerInvoiceSummary(recorder, req)

			if recorder.Code != tt.wantStatus {
				t.Fatalf("got status %d, want %d; body: %s", recorder.Code, tt.wantStatus, recorder.Body.String())
			}

			if tt.wantStatus == http.StatusOK {
				var resp map[string]interface{}
				if err := json.Unmarshal(recorder.Body.Bytes(), &resp);
				err != nil {
					t.Fatalf("unmarshal response: %v", err)
				}
				if resp["buyer"] != tt.address {
					t.Errorf("got buyer %v, want %v", resp["buyer"], tt.address)
				}
			}
		})
	}
}

func TestGetBuyerInvoiceSummary_Database(t *testing.T) {
	if db.Pool == nil {
		t.Skip("database pool not initialized; skipping DB integration test")
	}

	ctx := context.Background()
	buyer, err := keypair.Random()
	if err != nil {
		t.Fatalf("generate buyer keypair: %v", err)
	}
	address := buyer.Address()

	// Empty state
	summary, err := db.GetBuyerInvoiceSummary(ctx, address, 1000000)
	if err != nil {
		t.Fatalf("get buyer invoice summary (empty): %v", err)
	}

	if summary.Buyer != address {
		t.Errorf("got buyer %q, want %q", summary.Buyer, address)
	}
	if summary.ConfirmedCount != 0 || summary.ConfirmedTotal != "0" {
		t.Errorf("expected zero confirmed count/total, got %d and %q", summary.ConfirmedCount, summary.ConfirmedTotal)
	}
	if summary.RepaidCount != 0 || summary.RepaidTotal != "0" {
		t.Errorf("expected zero repaid count/total, got %d and %q", summary.RepaidCount, summary.RepaidTotal)
	}
}
