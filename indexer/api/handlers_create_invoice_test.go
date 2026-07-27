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

func TestHandleCreateInvoice_InvalidRequests(t *testing.T) {
	h := newTestHandler(t)
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
			name:       "invalid json",
			body:       "{invalid",
			withIssuer: true,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "missing user address",
			body:       `{"buyer":"` + buyer.Address() + `","face_value":"1000","due_date":1700000000}`,
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "missing required parameters",
			body:       `{"buyer":"","face_value":"1000","due_date":1700000000}`,
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
				issuer, err := keypair.Random()
				if err != nil {
					t.Fatalf("generate issuer keypair: %v", err)
				}
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

func TestHandleCreateInvoice_RPCFailure(t *testing.T) {
	h := newTestHandler(t)
	buyer, err := keypair.Random()
	if err != nil {
		t.Fatalf("generate buyer keypair: %v", err)
	}
	issuer, err := keypair.Random()
	if err != nil {
		t.Fatalf("generate issuer keypair: %v", err)
	}

	rpc := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"jsonrpc":"2.0","id":1,"error":{"code":-1,"message":"rpc unavailable"}}`))
	}))
	defer rpc.Close()
	h.cfg.SorobanRPCURL = rpc.URL

	body := `{"buyer":"` + buyer.Address() + `","face_value":"1000","due_date":1700000000}`
	req := httptest.NewRequest(http.MethodPost, "/invoices", strings.NewReader(body))
	req = req.WithContext(WithUserAddress(req.Context(), issuer.Address()))
	recorder := httptest.NewRecorder()

	h.HandleCreateInvoice(recorder, req)

	if recorder.Code != http.StatusInternalServerError {
		t.Fatalf("got status %d, want %d; body: %s", recorder.Code, http.StatusInternalServerError, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), "failed to fetch server account") {
		t.Fatalf("expected account-fetch error, got %q", recorder.Body.String())
	}
}

func TestHandleCreateInvoice_HappyPath(t *testing.T) {
	h := newTestHandler(t)
	h.cfg.InvoiceContractID = "CAKEWH7SJCXGV2MH2WZYIX3QDPTSSBQFXYVYBOWAGLNBBZMPLE2US6CS"

	buyer, err := keypair.Random()
	if err != nil {
		t.Fatalf("generate buyer keypair: %v", err)
	}
	issuer, err := keypair.Random()
	if err != nil {
		t.Fatalf("generate issuer keypair: %v", err)
	}

	invoiceID := []byte{0xde, 0xad, 0xbe, 0xef}
	invoiceValue := xdr.ScBytes(invoiceID)
	invoiceResult := xdr.ScVal{Type: xdr.ScValTypeScvBytes, Bytes: &invoiceValue}
	invoiceResultBytes, err := invoiceResult.MarshalBinary()
	if err != nil {
		t.Fatalf("marshal invoice result: %v", err)
	}

	var transactionData xdr.SorobanTransactionData
	transactionDataBytes, err := transactionData.MarshalBinary()
	if err != nil {
		t.Fatalf("marshal transaction data: %v", err)
	}

	var requestCount atomic.Int32
	rpc := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount.Add(1)
		var request JsonRpcRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			http.Error(w, "invalid rpc request", http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		response := map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      1,
		}
		switch request.Method {
		case "getAccount":
			response["result"] = map[string]string{"id": h.serverKP.Address(), "sequence": "1"}
		case "simulateTransaction":
			response["result"] = map[string]interface{}{
				"transactionData": base64.StdEncoding.EncodeToString(transactionDataBytes),
				"minResourceFee":  "0",
				"results": []map[string]string{{
					"xdr": base64.StdEncoding.EncodeToString(invoiceResultBytes),
				}},
			}
		case "sendTransaction":
			response["result"] = map[string]string{"hash": "test-transaction-hash", "status": "PENDING"}
		case "getTransaction":
			response["result"] = map[string]string{"status": "SUCCESS", "hash": "test-transaction-hash"}
		default:
			response["result"] = map[string]string{}
		}
		if err := json.NewEncoder(w).Encode(response); err != nil {
			t.Errorf("encode rpc response: %v", err)
		}
	}))
	defer rpc.Close()
	h.cfg.SorobanRPCURL = rpc.URL

	body := `{"buyer":"` + buyer.Address() + `","face_value":"1000","due_date":4102444800}`
	req := httptest.NewRequest(http.MethodPost, "/invoices", bytes.NewBufferString(body))
	req = req.WithContext(WithUserAddress(req.Context(), issuer.Address()))
	recorder := httptest.NewRecorder()

	h.HandleCreateInvoice(recorder, req)

	if recorder.Code < http.StatusOK || recorder.Code >= http.StatusMultipleChoices {
		t.Fatalf("got status %d, want successful response; body: %s", recorder.Code, recorder.Body.String())
	}
	if requestCount.Load() < 2 {
		t.Fatalf("expected account and simulation RPC calls, got %d", requestCount.Load())
	}
	if !strings.Contains(recorder.Body.String(), "deadbeef") {
		t.Fatalf("expected invoice id in response, got %q", recorder.Body.String())
	}
}
