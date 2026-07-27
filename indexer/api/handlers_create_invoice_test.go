package api

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stellar/go-stellar-sdk/keypair"
	"github.com/stellar/go-stellar-sdk/xdr"
)

func encodeTestScVal(t *testing.T, value xdr.ScVal) string {
	t.Helper()

	encoded, err := value.MarshalBinary()
	if err != nil {
		t.Fatalf("marshal test ScVal: %v", err)
	}
	return base64.StdEncoding.EncodeToString(encoded)
}

func testInvoiceResultXDR(t *testing.T) string {
	t.Helper()

	invoiceID := xdr.ScBytes([]byte("invoice-test-id"))
	return encodeTestScVal(t, xdr.ScVal{
		Type:  xdr.ScValTypeScvBytes,
		Bytes: &invoiceID,
	})
}

func testSorobanTransactionData(t *testing.T) string {
	t.Helper()

	data := xdr.SorobanTransactionData{
		Ext: xdr.ExtensionPoint{V: 0},
	}
	encoded, err := data.MarshalBinary()
	if err != nil {
		t.Fatalf("marshal Soroban transaction data: %v", err)
	}
	return base64.StdEncoding.EncodeToString(encoded)
}

func newCreateInvoiceRPCServer(t *testing.T, failMethod string) *httptest.Server {
	t.Helper()

	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request JsonRpcRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			http.Error(w, "invalid JSON-RPC request", http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		if request.Method == failMethod {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      request.Id,
				"error": map[string]interface{}{
					"code":    -32000,
					"message": "mock RPC failure",
				},
			})
			return
		}

		var result interface{}
		switch request.Method {
		case "getAccount":
			result = GetAccountResponse{ID: "mock-account", Sequence: "7"}
		case "simulateTransaction":
			result = SimulateResponse{
				TransactionData: testSorobanTransactionData(t),
				MinResourceFee:  "0",
				Results: []struct {
					Xdr string `json:"xdr"`
				}{{Xdr: testInvoiceResultXDR(t)}},
			}
		case "sendTransaction":
			result = map[string]string{
				"status": "PENDING",
				"hash":   "mock-transaction-hash",
			}
		case "getTransaction":
			result = map[string]string{
				"status": "SUCCESS",
				"hash":   "mock-transaction-hash",
			}
		default:
			result = map[string]interface{}{}
		}

		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      request.Id,
			"result":  result,
		})
	}))
}

func TestHandleCreateInvoice(t *testing.T) {
	h := newTestHandler(t)
	issuer := h.serverKP.Address()
	buyerKP, err := keypair.Random()
	if err != nil {
		t.Fatalf("generate buyer keypair: %v", err)
	}

	tests := []struct {
		name         string
		body         string
		withAuth     bool
		failRPC      string
		wantStatus   int
		wantContains string
	}{
		{
			name:         "happy path",
			body:         `{"buyer":"` + buyerKP.Address() + `","face_value":"1000000","due_date":1700000000}`,
			withAuth:     true,
			wantStatus:   http.StatusOK,
			wantContains: "696e766f6963652d746573742d6964",
		},
		{
			name:       "invalid JSON",
			body:       "{invalid",
			withAuth:   true,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "invalid buyer address",
			body:       `{"buyer":"not-an-address","face_value":"1000000","due_date":1700000000}`,
			withAuth:   true,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "missing authentication context",
			body:       `{"buyer":"` + buyerKP.Address() + `","face_value":"1000000","due_date":1700000000}`,
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "account RPC failure",
			body:       `{"buyer":"` + buyerKP.Address() + `","face_value":"1000000","due_date":1700000000}`,
			withAuth:   true,
			failRPC:    "getAccount",
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.failRPC != "" || tt.name == "happy path" {
				rpcServer := newCreateInvoiceRPCServer(t, tt.failRPC)
				defer rpcServer.Close()
				h.cfg.SorobanRPCURL = rpcServer.URL
				h.cfg.InvoiceContractID = "CAKEWH7SJCXGV2MH2WZYIX3QDPTSSBQFXYVYBOWAGLNBBZMPLE2US6CS"
			}

			req := httptest.NewRequest(http.MethodPost, "/invoices", bytes.NewBufferString(tt.body))
			req.Header.Set("Content-Type", "application/json")
			if tt.withAuth {
				req = req.WithContext(WithUserAddress(req.Context(), issuer))
			}

			recorder := httptest.NewRecorder()
			h.HandleCreateInvoice(recorder, req)

			if recorder.Code != tt.wantStatus {
				t.Fatalf("status: got %d, want %d; body: %s", recorder.Code, tt.wantStatus, recorder.Body.String())
			}
			if tt.wantContains != "" && !strings.Contains(recorder.Body.String(), tt.wantContains) {
				t.Fatalf("response body %q does not contain %q", recorder.Body.String(), tt.wantContains)
			}
		})
	}
}
