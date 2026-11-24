package api

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"trusttrove/indexer/soroban"

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
		{
			name:       "past due date",
			body:       `{"buyer":"` + buyer.Address() + `","face_value":"1000","due_date":1700000000}`,
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

func TestHandleCreateInvoice_FaceValueExceedsU128(t *testing.T) {
	h := newTestHandler(t)
	issuer, err := keypair.Random()
	if err != nil {
		t.Fatalf("generate issuer keypair: %v", err)
	}
	buyer, err := keypair.Random()
	if err != nil {
		t.Fatalf("generate buyer keypair: %v", err)
	}

	recorder := invoiceRequest(t, h, issuer.Address(), buyer.Address(), "340282366920938463463374607431768211456", time.Now().Add(24*time.Hour).Unix())
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("got status %d, want %d; body: %s", recorder.Code, http.StatusBadRequest, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), "exceeds the u128 range") {
		t.Fatalf("expected u128 range error, got %q", recorder.Body.String())
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

	recorder := invoiceRequest(t, h, issuer.Address(), buyer.Address(), "1000", time.Now().Add(24*time.Hour).Unix())
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
		var request soroban.JsonRpcRequest
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

	recorder := invoiceRequest(t, h, issuer.Address(), buyer.Address(), "1000", time.Now().Add(24*time.Hour).Unix())
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

// TestHandleCreateInvoice_OversizedBody expects 413 for a body over
// maxCreateInvoiceBodyBytes. The request carries no authenticated issuer, so
// reaching validation would answer 401 instead; 413 proves the limit is
// enforced first.
func TestHandleCreateInvoice_OversizedBody(t *testing.T) {
	h := newTestHandler(t)

	body := `{"buyer":"` + strings.Repeat("G", int(maxCreateInvoiceBodyBytes)) + `","face_value":"1000","due_date":1700000000}`
	req := httptest.NewRequest(http.MethodPost, "/invoices", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	h.HandleCreateInvoice(recorder, req)

	if recorder.Code != http.StatusRequestEntityTooLarge {
		t.Errorf("oversized body: got status %d, want %d", recorder.Code, http.StatusRequestEntityTooLarge)
	}
}

// invoiceSimulationResponse returns the simulateTransaction result body used by
// the sequence tests below.
func invoiceSimulationResponse(t *testing.T) string {
	t.Helper()

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

	return `{"jsonrpc":"2.0","id":1,"result":{"transactionData":"` + base64.StdEncoding.EncodeToString(transactionData) + `","minResourceFee":"100","results":[{"xdr":"` + base64.StdEncoding.EncodeToString(invoiceIDXDR) + `"}]}}`
}

// TestHandleCreateInvoice_ConcurrentSequenceAssignment fires N concurrent
// create-invoice requests at a stub Soroban RPC that rejects duplicate sequence
// numbers. Every request must succeed with a distinct sequence number, which
// regressed before issue #940 was fixed.
func TestHandleCreateInvoice_ConcurrentSequenceAssignment(t *testing.T) {
	const requests = 10

	h := newTestHandler(t)
	h.cfg.InvoiceContractID = "CAKEWH7SJCXGV2MH2WZYIX3QDPTSSBQFXYVYBOWAGLNBBZMPLE2US6CS"

	issuer, err := keypair.Random()
	if err != nil {
		t.Fatalf("generate issuer keypair: %v", err)
	}
	buyer, err := keypair.Random()
	if err != nil {
		t.Fatalf("generate buyer keypair: %v", err)
	}

	var mu sync.Mutex
	accountSeq := int64(100)
	seen := make(map[int64]bool)
	submitted := make([]int64, 0, requests)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request soroban.JsonRpcRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		var response string
		switch request.Method {
		case "getAccount":
			mu.Lock()
			seq := accountSeq
			mu.Unlock()
			response = fmt.Sprintf(`{"jsonrpc":"2.0","id":1,"result":{"id":%q,"sequence":"%d"}}`, h.serverKP.Address(), seq)
		case "simulateTransaction":
			response = invoiceSimulationResponse(t)
		case "sendTransaction":
			paramsBytes, _ := json.Marshal(request.Params)
			var params struct {
				Transaction string `json:"transaction"`
			}
			_ = json.Unmarshal(paramsBytes, &params)

			var env xdr.TransactionEnvelope
			if err := xdr.SafeUnmarshalBase64(params.Transaction, &env); err != nil || env.V1 == nil {
				response = `{"jsonrpc":"2.0","id":1,"result":{"status":"ERROR","error":"invalid transaction"}}`
				break
			}
			seq := int64(env.V1.Tx.SeqNum)

			mu.Lock()
			if seen[seq] || seq != accountSeq+1 {
				mu.Unlock()
				response = `{"jsonrpc":"2.0","id":1,"result":{"status":"ERROR","error":"tx_bad_seq"}}`
				break
			}
			seen[seq] = true
			accountSeq = seq
			submitted = append(submitted, seq)
			mu.Unlock()

			response = fmt.Sprintf(`{"jsonrpc":"2.0","id":1,"result":{"hash":"hash-%d","status":"PENDING"}}`, seq)
		case "getTransaction":
			response = `{"jsonrpc":"2.0","id":1,"result":{"status":"SUCCESS","hash":"test-hash"}}`
		default:
			response = `{"jsonrpc":"2.0","id":1,"error":{"code":-32601,"message":"method not found"}}`
		}
		_, _ = w.Write([]byte(response))
	}))
	defer server.Close()
	h.cfg.SorobanRPCURL = server.URL

	codes := make([]int, requests)
	var wg sync.WaitGroup
	wg.Add(requests)
	for i := 0; i < requests; i++ {
		go func(i int) {
			defer wg.Done()
			recorder := invoiceRequest(t, h, issuer.Address(), buyer.Address(), "1000", time.Now().Add(24*time.Hour).Unix())
			codes[i] = recorder.Code
		}(i)
	}
	wg.Wait()

	for i, code := range codes {
		if code != http.StatusCreated {
			t.Errorf("request %d: got status %d, want %d", i, code, http.StatusCreated)
		}
	}

	mu.Lock()
	defer mu.Unlock()
	if len(submitted) != requests {
		t.Fatalf("submitted %d transactions, want %d", len(submitted), requests)
	}
	distinct := make(map[int64]bool, requests)
	for _, seq := range submitted {
		if distinct[seq] {
			t.Errorf("sequence %d was submitted more than once", seq)
		}
		distinct[seq] = true
	}
	if len(distinct) != requests {
		t.Fatalf("got %d distinct sequences, want %d", len(distinct), requests)
	}
}

// TestHandleCreateInvoice_SequenceConflictReturns409 verifies that a sequence
// rejection is retried once and then surfaced as a retryable 409 rather than a
// 500.
func TestHandleCreateInvoice_SequenceConflictReturns409(t *testing.T) {
	h := newTestHandler(t)
	h.cfg.InvoiceContractID = "CAKEWH7SJCXGV2MH2WZYIX3QDPTSSBQFXYVYBOWAGLNBBZMPLE2US6CS"

	issuer, err := keypair.Random()
	if err != nil {
		t.Fatalf("generate issuer keypair: %v", err)
	}
	buyer, err := keypair.Random()
	if err != nil {
		t.Fatalf("generate buyer keypair: %v", err)
	}

	var sendCalls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request soroban.JsonRpcRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		var response string
		switch request.Method {
		case "getAccount":
			response = fmt.Sprintf(`{"jsonrpc":"2.0","id":1,"result":{"id":%q,"sequence":"100"}}`, h.serverKP.Address())
		case "simulateTransaction":
			response = invoiceSimulationResponse(t)
		case "sendTransaction":
			sendCalls.Add(1)
			response = `{"jsonrpc":"2.0","id":1,"result":{"status":"ERROR","error":"tx_bad_seq"}}`
		default:
			response = `{"jsonrpc":"2.0","id":1,"error":{"code":-32601,"message":"method not found"}}`
		}
		_, _ = w.Write([]byte(response))
	}))
	defer server.Close()
	h.cfg.SorobanRPCURL = server.URL

	recorder := invoiceRequest(t, h, issuer.Address(), buyer.Address(), "1000", time.Now().Add(24*time.Hour).Unix())
	if recorder.Code != http.StatusConflict {
		t.Fatalf("got status %d, want %d; body: %s", recorder.Code, http.StatusConflict, recorder.Body.String())
	}
	if sendCalls.Load() != 2 {
		t.Fatalf("sendTransaction calls: got %d, want 2 (initial attempt plus one retry)", sendCalls.Load())
	}
	if !strings.Contains(recorder.Body.String(), "retry") {
		t.Fatalf("expected retryable message, got %q", recorder.Body.String())
	}
}
