package api

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/stellar/go-stellar-sdk/keypair"
	"github.com/stellar/go-stellar-sdk/xdr"
)

func invoiceRequest(t *testing.T, h *APIHandler, issuer, buyer, faceValue string, dueDate int64) *httptest.ResponseRecorder {
	t.Helper()

	body, err := json.Marshal(map[string]interface{}{
		"buyer":      buyer,
		"face_value": faceValue,
		"due_date":   dueDate,
	})
	if err != nil {
		t.Fatalf("marshal invoice request: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/invoices", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = req.WithContext(WithUserAddress(req.Context(), issuer))

	recorder := httptest.NewRecorder()
	h.HandleCreateInvoice(recorder, req)
	return recorder
}

func TestHandleCreateInvoice_InvalidRequests(t *testing.T) {
	h := newTestHandler(t)
	issuer, err := keypair.Random()
	if err != nil {
		t.Fatalf("generate issuer keypair: %v", err)
	}
	buyer, err := keypair.Random()
	if err != nil {
		t.Fatalf("generate buyer keypair: %v", err)
	}

	tests := []struct {
		name       string
		body       string
		withIssuer bool
		wantStatus int
	}{
		{
			name:       "malformed JSON",
			body:       "{invalid",
			withIssuer: true,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "missing authentication context",
			body:       `{"buyer":"` + buyer.Address() + `","face_value":"1000","due_date":1700000000}`,
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "missing required fields",
			body:       `{"buyer":"","face_value":"","due_date":0}`,
			withIssuer: true,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "invalid buyer address",
			body:       `{"buyer":"not-a-stellar-address","face_value":"1000","due_date":1700000000}`,
			withIssuer: true,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "invalid face value",
			body:       `{"buyer":"` + buyer.Address() + `","face_value":"0","due_date":1700000000}`,
			withIssuer: true,
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/invoices", strings.NewReader(tt.body))
			req.Header.Set("Content-Type", "application/json")
			if tt.withIssuer {
				req = req.WithContext(WithUserAddress(req.Context(), issuer.Address()))
			}

			recorder := httptest.NewRecorder()
			h.HandleCreateInvoice(recorder, req)

			if recorder.Code != tt.wantStatus {
				t.Fatalf("got status %d, want %d; body: %s", recorder.Code, tt.wantStatus, recorder.Body.String())
			}
		})
	}
}

func TestHandleCreateInvoice_SorobanRPCFailure(t *testing.T) {
	h := newTestHandler(t)
	issuer, err := keypair.Random()
	if err != nil {
		t.Fatalf("generate issuer keypair: %v", err)
	}
	buyer, err := keypair.Random()
	if err != nil {
		t.Fatalf("generate buyer keypair: %v", err)
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"jsonrpc":"2.0","id":1,"error":{"code":-32000,"message":"upstream unavailable"}}`))
	}))
	defer server.Close()
	h.cfg.SorobanRPCURL = server.URL

	recorder := invoiceRequest(t, h, issuer.Address(), buyer.Address(), "1000", 1700000000)
	if recorder.Code != http.StatusInternalServerError {
		t.Fatalf("got status %d, want %d; body: %s", recorder.Code, http.StatusInternalServerError, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), "failed to fetch server account") {
		t.Fatalf("expected account-fetch error, got %q", recorder.Body.String())
	}
}

func TestHandleCreateInvoice_HappyPath(t *testing.T) {
	h := newTestHandler(t)
	// newTestHandler intentionally creates only the common test configuration.
	// HandleCreateInvoice also requires a valid invoice contract address.
	h.cfg.InvoiceContractID = "CAKEWH7SJCXGV2MH2WZYIX3QDPTSSBQFXYVYBOWAGLNBBZMPLE2US6CS"

	issuer, err := keypair.Random()
	if err != nil {
		t.Fatalf("generate issuer keypair: %v", err)
	}
	buyer, err := keypair.Random()
	if err != nil {
		t.Fatalf("generate buyer keypair: %v", err)
	}

	invoiceID := []byte("invoice-1")
	invoiceIDVal := xdr.ScBytes(invoiceID)
	invoiceIDScVal := xdr.ScVal{Type: xdr.ScValTypeScvBytes, Bytes: &invoiceIDVal}
	invoiceIDXDR, err := invoiceIDScVal.MarshalBinary()
	if err != nil {
		t.Fatalf("marshal invoice id ScVal: %v", err)
	}

	transactionData, err := (xdr.SorobanTransactionData{}).MarshalBinary()
	if err != nil {
		t.Fatalf("marshal transaction data: %v", err)
	}

	var simulateCalls atomic.Int32
	var transactionCalls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request JsonRpcRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		var response string
		switch request.Method {
		case "getAccount":
			response = `{"jsonrpc":"2.0","id":1,"result":{"id":"` + h.serverKP.Address() + `","sequence":"1"}}`
		case "simulateTransaction":
			simulateCalls.Add(1)
			response = `{"jsonrpc":"2.0","id":1,"result":{"transactionData":"` + base64.StdEncoding.EncodeToString(transactionData) + `","minResourceFee":"100","results":[{"xdr":"` + base64.StdEncoding.EncodeToString(invoiceIDXDR) + `"}]}}`
		case "sendTransaction":
			transactionCalls.Add(1)
			response = `{"jsonrpc":"2.0","id":1,"result":{"hash":"test-hash","status":"PENDING"}}`
		case "getTransaction":
			response = `{"jsonrpc":"2.0","id":1,"result":{"status":"SUCCESS","hash":"test-hash"}}`
		default:
			response = `{"jsonrpc":"2.0","id":1,"error":{"code":-32601,"message":"method not found"}}`
		}
		_, _ = w.Write([]byte(response))
	}))
	defer server.Close()
	h.cfg.SorobanRPCURL = server.URL

	recorder := invoiceRequest(t, h, issuer.Address(), buyer.Address(), "1000", 1700000000)
	if recorder.Code != http.StatusOK && recorder.Code != http.StatusCreated {
		t.Fatalf("got status %d, want 200 or 201; body: %s", recorder.Code, recorder.Body.String())
	}
	if simulateCalls.Load() != 1 {
		t.Fatalf("simulateTransaction calls: got %d, want 1", simulateCalls.Load())
	}
	if transactionCalls.Load() != 1 {
		t.Fatalf("sendTransaction calls: got %d, want 1", transactionCalls.Load())
	}
	if !strings.Contains(recorder.Body.String(), "invoice") {
		t.Fatalf("response does not contain invoice data: %s", recorder.Body.String())
	}
}
