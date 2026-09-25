package soroban

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/stellar/go-stellar-sdk/keypair"
	"github.com/stellar/go-stellar-sdk/txnbuild"
	"github.com/stellar/go-stellar-sdk/xdr"
)

// JsonRpcRequest is the JSON-RPC 2.0 envelope sent to the Soroban RPC server.
type JsonRpcRequest struct {
	Jsonrpc string      `json:"jsonrpc"`
	Id      int         `json:"id"`
	Method  string      `json:"method"`
	Params  interface{} `json:"params"`
}

// JsonRpcResponse is the JSON-RPC 2.0 envelope returned by the Soroban RPC server.
type JsonRpcResponse struct {
	Jsonrpc string          `json:"jsonrpc"`
	Id      int             `json:"id"`
	Result  json.RawMessage `json:"result"`
	Error   *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

// SimulateResponse is the subset of the simulateTransaction result the indexer uses.
type SimulateResponse struct {
	TransactionData string `json:"transactionData"`
	MinResourceFee  string `json:"minResourceFee"`
	Results         []struct {
		Xdr string `json:"xdr"`
	} `json:"results"`
}

// GetAccountResponse is the subset of the getAccount result the indexer uses.
type GetAccountResponse struct {
	ID       string `json:"id"`
	Sequence string `json:"sequence"`
}

var rpcClient = &http.Client{
	Timeout: 30 * time.Second,
}

// Retry tuning for CallSorobanRPC. RPCMaxRetries is the number of retries
// after the initial attempt (so the default of 3 allows up to 4 total
// requests); RPCRetryBaseDelay is the base for exponential backoff
// (delay before retry N is base * 2^(N-1), capped by RPCRetryMaxDelay).
// Tests may shrink RPCRetryBaseDelay to run fast.
var (
	RPCMaxRetries     = 3
	RPCRetryBaseDelay = 100 * time.Millisecond
	RPCRetryMaxDelay  = 5 * time.Second
)

// isRetryableStatus reports whether an HTTP status is worth retrying:
// 429 (rate limited) or any 5xx. All other statuses — including other 4xx
// and 3xx/2xx — are terminal for the transport layer.
func isRetryableStatus(code int) bool {
	return code == http.StatusTooManyRequests || (code >= 500 && code <= 599)
}

// retryDelay returns the backoff delay before retry number attempt (1-based).
func retryDelay(attempt int) time.Duration {
	d := RPCRetryBaseDelay << (attempt - 1)
	if d <= 0 || d > RPCRetryMaxDelay {
		return RPCRetryMaxDelay
	}
	return d
}

// sleepOrDone waits for d unless ctx is cancelled first, returning ctx.Err()
// on cancellation and nil once the delay has elapsed.
func sleepOrDone(ctx context.Context, d time.Duration) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-time.After(d):
		return nil
	}
}

// CallSorobanRPC issues a JSON-RPC call against rpcURL and decodes the result
// field into result. A JSON-RPC error envelope is returned as a Go error.
//
// Transient failures — network errors and HTTP 429/5xx responses — are
// retried up to RPCMaxRetries times with exponential backoff. All other
// failures (other HTTP statuses, JSON-RPC error envelopes, decode errors,
// cancelled contexts) fail fast without retrying.
func CallSorobanRPC(ctx context.Context, rpcURL string, method string, params interface{}, result interface{}) error {
	reqBody := JsonRpcRequest{
		Jsonrpc: "2.0",
		Id:      1,
		Method:  method,
		Params:  params,
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return err
	}

	var lastErr error
	for attempt := 0; attempt <= RPCMaxRetries; attempt++ {
		if attempt > 0 {
			if err := sleepOrDone(ctx, retryDelay(attempt)); err != nil {
				return err
			}
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodPost, rpcURL, bytes.NewBuffer(bodyBytes))
		if err != nil {
			return err
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := rpcClient.Do(req)
		if err != nil {
			// Never retry a cancelled/deadlined context — that is
			// caller intent, not a transient RPC failure.
			if ctx.Err() != nil {
				return err
			}
			lastErr = fmt.Errorf("soroban RPC request failed: %w", err)
			continue
		}

		if isRetryableStatus(resp.StatusCode) {
			body, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<10))
			resp.Body.Close()
			lastErr = fmt.Errorf("soroban RPC returned retryable HTTP status %d: %s", resp.StatusCode, string(body))
			continue
		}

		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			body, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<10))
			resp.Body.Close()
			return fmt.Errorf("soroban RPC returned HTTP status %d: %s", resp.StatusCode, string(body))
		}

		var rpcResp JsonRpcResponse
		decodeErr := json.NewDecoder(resp.Body).Decode(&rpcResp)
		resp.Body.Close()
		if decodeErr != nil {
			return decodeErr
		}

		if rpcResp.Error != nil {
			return fmt.Errorf("rpc error: %s (code %d)", rpcResp.Error.Message, rpcResp.Error.Code)
		}

		return json.Unmarshal(rpcResp.Result, result)
	}

	return lastErr
}

// ReadContract simulates a read-only invocation of method on contractID and
// returns the decoded ScVal result. Nothing is submitted to the network.
func ReadContract(
	ctx context.Context,
	rpcURL string,
	contractID string,
	method string,
	args []xdr.ScVal,
	serverKP *keypair.Full,
) (xdr.ScVal, error) {
	op, err := BuildInvokeContractOp(contractID, method, args)
	if err != nil {
		return xdr.ScVal{}, err
	}

	tx, err := txnbuild.NewTransaction(txnbuild.TransactionParams{
		SourceAccount: &txnbuild.SimpleAccount{
			AccountID: serverKP.Address(),
			Sequence:  0,
		},
		IncrementSequenceNum: false,
		BaseFee:              txnbuild.MinBaseFee,
		Preconditions: txnbuild.Preconditions{
			TimeBounds: txnbuild.NewTimebounds(0, time.Now().Add(1*time.Hour).Unix()),
		},
		Operations: []txnbuild.Operation{op},
	})
	if err != nil {
		return xdr.ScVal{}, err
	}

	txBase64, err := tx.Base64()
	if err != nil {
		return xdr.ScVal{}, err
	}

	var simResp SimulateResponse
	err = CallSorobanRPC(ctx, rpcURL, "simulateTransaction", map[string]string{"transaction": txBase64}, &simResp)
	if err != nil {
		return xdr.ScVal{}, err
	}

	if len(simResp.Results) == 0 {
		return xdr.ScVal{}, errors.New("no result from simulation")
	}

	var val xdr.ScVal
	err = xdr.SafeUnmarshalBase64(simResp.Results[0].Xdr, &val)
	if err != nil {
		return xdr.ScVal{}, err
	}

	return val, nil
}
