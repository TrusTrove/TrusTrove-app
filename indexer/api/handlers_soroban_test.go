package api

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stellar/go-stellar-sdk/keypair"
	"github.com/stellar/go-stellar-sdk/strkey"
	"github.com/stellar/go-stellar-sdk/xdr"
)

// newSorobanRPCStub returns a httptest.Server that responds with a JSON-RPC
// envelope wrapping handler(method, params). It writes a non-200 status when
// status != http.StatusOK, otherwise encodes {"jsonrpc":"2.0","id":1,"result":body}.
// Cleanup is registered with t.Cleanup.
func newSorobanRPCStub(t *testing.T, handler func(method string, params json.RawMessage) (body any, status int)) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Method string          `json:"method"`
			Params json.RawMessage `json:"params"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		body, status := handler(req.Method, req.Params)
		if status != http.StatusOK {
			w.WriteHeader(status)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"jsonrpc": "2.0",
			"id":      1,
			"result":  body,
		})
	}))
	t.Cleanup(server.Close)
	return server
}

// encodeScVal marshals an xdr.ScVal to base64 for use in mocked RPC responses.
func encodeScVal(t *testing.T, val xdr.ScVal) string {
	t.Helper()
	b, err := val.MarshalBinary()
	if err != nil {
		t.Fatalf("marshal scval: %v", err)
	}
	return base64.StdEncoding.EncodeToString(b)
}

// validContractID returns a syntactically valid 56-char C... Stellar contract
// ID for tests that exercise ParseAddressToScAddress / ReadContract. We
// synthesize 32 deterministic bytes and encode them via strkey.
func validContractID(t *testing.T) string {
	t.Helper()
	raw := make([]byte, 32)
	for i := range raw {
		raw[i] = byte(i + 1)
	}
	out, err := strkey.Encode(strkey.VersionByteContract, raw)
	if err != nil {
		t.Fatalf("strkey encode contract id: %v", err)
	}
	if len(out) != 56 || out[0] != 'C' {
		t.Fatalf("unexpected encoded contract id: %q (len %d)", out, len(out))
	}
	return out
}

// ------------------------------------------------------------------
// CallSorobanRPC
// ------------------------------------------------------------------

func TestCallSorobanRPC_HappyPathDecodesResult(t *testing.T) {
	server := newSorobanRPCStub(t, func(method string, _ json.RawMessage) (any, int) {
		if method != "getLatestLedger" {
			t.Errorf("unexpected RPC method dispatched: %s", method)
		}
		return map[string]any{"sequence": int32(12345)}, http.StatusOK
	})

	var result struct {
		Sequence int32 `json:"sequence"`
	}
	if err := CallSorobanRPC(context.Background(), server.URL, "getLatestLedger", nil, &result); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if result.Sequence != 12345 {
		t.Errorf("expected sequence=12345, got %d", result.Sequence)
	}
}

func TestCallSorobanRPC_RPCErrorMessageIsReturned(t *testing.T) {
	server := newSorobanRPCStub(t, func(_ string, _ json.RawMessage) (any, int) {
		// Hand back the JSON-RPC error envelope by short-circuiting the
		// standard "result" path of the helper — the helper treats a
		// non-200 status as a transport-style error, so we encode the
		// envelope ourselves by using a direct handler instead. Register
		// the direct handler via the same httptest server.
		return nil, http.StatusOK
	})
	server.Close()
	server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"jsonrpc": "2.0",
			"id":      1,
			"result":  nil,
			"error":   map[string]any{"code": -32600, "message": "method not found"},
		})
	}))
	t.Cleanup(server.Close)

	var result any
	err := CallSorobanRPC(context.Background(), server.URL, "anything", nil, &result)
	if err == nil {
		t.Fatal("expected error when server returns JSON-RPC error envelope")
	}
	if !strings.Contains(err.Error(), "method not found") {
		t.Errorf("expected error message to include server message, got %v", err)
	}
}

func TestCallSorobanRPC_HTTP500IsReturned(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	t.Cleanup(server.Close)

	var result any
	if err := CallSorobanRPC(context.Background(), server.URL, "anything", nil, &result); err == nil {
		t.Fatal("expected error when server returns HTTP 500")
	}
}

func TestCallSorobanRPC_UnreachableURLReturnsError(t *testing.T) {
	var result any
	if err := CallSorobanRPC(context.Background(), "http://127.0.0.1:1", "anything", nil, &result); err == nil {
		t.Fatal("expected error for unreachable host")
	}
}

// ------------------------------------------------------------------
// ReadContract
// ------------------------------------------------------------------

func TestReadContract_HappyPathReturnsDecodedScVal(t *testing.T) {
	u32 := xdr.Uint32(98765)
	want := xdr.ScVal{Type: xdr.ScValTypeScvU32, U32: &u32}
	xdrB64 := encodeScVal(t, want)

	server := newSorobanRPCStub(t, func(method string, _ json.RawMessage) (any, int) {
		if method != "simulateTransaction" {
			t.Errorf("unexpected RPC method dispatched: %s", method)
		}
		return map[string]any{
			"transactionData": "",
			"minResourceFee":  "0",
			"results":         []map[string]any{{"xdr": xdrB64}},
		}, http.StatusOK
	})

	serverKP, err := keypair.Random()
	if err != nil {
		t.Fatalf("generate keypair: %v", err)
	}
	got, err := ReadContract(context.Background(), server.URL, validContractID(t), "anyMethod", nil, serverKP)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if got.Type != xdr.ScValTypeScvU32 {
		t.Errorf("expected ScvU32, got %v", got.Type)
	}
	if got.U32 == nil || *got.U32 != xdr.Uint32(98765) {
		t.Errorf("expected U32=98765, got %v", got.U32)
	}
}

func TestReadContract_NoResultReturnsError(t *testing.T) {
	server := newSorobanRPCStub(t, func(_ string, _ json.RawMessage) (any, int) {
		return map[string]any{
			"transactionData": "",
			"minResourceFee":  "0",
			"results":         []map[string]any{},
		}, http.StatusOK
	})

	serverKP, _ := keypair.Random()
	_, err := ReadContract(context.Background(), server.URL, validContractID(t), "anyMethod", nil, serverKP)
	if err == nil {
		t.Fatal("expected error when simulateTransaction returns no results")
	}
	if !strings.Contains(err.Error(), "no result from simulation") {
		t.Errorf("expected 'no result from simulation' in error, got %v", err)
	}
}

func TestReadContract_InvalidResultXDRReturnsError(t *testing.T) {
	server := newSorobanRPCStub(t, func(_ string, _ json.RawMessage) (any, int) {
		return map[string]any{
			"transactionData": "",
			"minResourceFee":  "0",
			"results":         []map[string]any{{"xdr": "definitely-not-base64!!!"}},
		}, http.StatusOK
	})

	serverKP, _ := keypair.Random()
	_, err := ReadContract(context.Background(), server.URL, validContractID(t), "anyMethod", nil, serverKP)
	if err == nil {
		t.Fatal("expected unmarshal error when result XDR is invalid")
	}
}

// ------------------------------------------------------------------
// ParseInvoiceIDFromResult
// ------------------------------------------------------------------

func TestParseInvoiceIDFromResult_HappyPathReturnsHex(t *testing.T) {
	invBytes := []byte("abc123")
	sb := xdr.ScBytes(invBytes)
	val := xdr.ScVal{Type: xdr.ScValTypeScvBytes, Bytes: &sb}
	got, err := ParseInvoiceIDFromResult(encodeScVal(t, val))
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	want := "616263313233" // hex of "abc123"
	if got != want {
		t.Errorf("expected hex %q, got %q", want, got)
	}
}

func TestParseInvoiceIDFromResult_InvalidBase64ReturnsError(t *testing.T) {
	if _, err := ParseInvoiceIDFromResult("not valid base64 $$$"); err == nil {
		t.Fatal("expected error for invalid base64 XDR")
	}
}

func TestParseInvoiceIDFromResult_NonBytesScValReturnsError(t *testing.T) {
	u64 := xdr.Uint64(42)
	val := xdr.ScVal{Type: xdr.ScValTypeScvU64, U64: &u64}
	_, err := ParseInvoiceIDFromResult(encodeScVal(t, val))
	if err == nil {
		t.Fatal("expected error when result is not a bytes ScVal")
	}
	if !strings.Contains(err.Error(), "not bytes") {
		t.Errorf("expected 'not bytes' in error, got %v", err)
	}
}
