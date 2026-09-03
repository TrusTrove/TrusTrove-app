package soroban

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
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

// CallSorobanRPC issues a JSON-RPC call against rpcURL and decodes the result
// field into result. A JSON-RPC error envelope is returned as a Go error.
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

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, rpcURL, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := rpcClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var rpcResp JsonRpcResponse
	if err := json.NewDecoder(resp.Body).Decode(&rpcResp); err != nil {
		return err
	}

	if rpcResp.Error != nil {
		return fmt.Errorf("rpc error: %s (code %d)", rpcResp.Error.Message, rpcResp.Error.Code)
	}

	return json.Unmarshal(rpcResp.Result, result)
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
