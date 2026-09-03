package api

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"math/big"
	"net/http"
	"strconv"
	"time"

	"trusttrove/indexer/soroban"

	"github.com/stellar/go-stellar-sdk/keypair"
	"github.com/stellar/go-stellar-sdk/txnbuild"
	"github.com/stellar/go-stellar-sdk/xdr"
)

// maxPollAttempts bounds how long HandleCreateInvoice waits for a submitted
// transaction to reach a terminal state before giving up.
const maxPollAttempts = 30

// createInvoicePollDelay is the pause between getTransaction polls.
const createInvoicePollDelay = 1 * time.Second

// createInvoiceRequest is the JSON body accepted by POST /invoices.
type createInvoiceRequest struct {
	Buyer     string `json:"buyer"`
	FaceValue string `json:"face_value"`
	DueDate   int64  `json:"due_date"`
}

// createInvoiceParams holds the validated contract arguments derived from a
// createInvoiceRequest plus the authenticated issuer.
type createInvoiceParams struct {
	Issuer    string
	Buyer     string
	FaceValue *big.Int
	DueDate   uint64
}

// HandleCreateInvoice serves POST /invoices (protected). It is an orchestration
// of three steps: validate the request, build and sign the on-chain
// transaction, then submit it and wait for confirmation.
func (h *APIHandler) HandleCreateInvoice(w http.ResponseWriter, r *http.Request) {
	var body createInvoiceRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	params, err := validateCreateInvoiceRequest(r.Context(), body)
	if err != nil {
		writeHTTPError(w, err)
		return
	}

	signedTx, invoiceID, err := h.buildCreateInvoiceTx(r.Context(), params)
	if err != nil {
		writeHTTPError(w, err)
		return
	}

	hash, status, err := h.submitAndConfirm(r.Context(), signedTx)
	if err != nil {
		writeHTTPError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, map[string]string{
		"invoice_id":       invoiceID,
		"transaction_hash": hash,
		"status":           status,
	})
}

// validateCreateInvoiceRequest checks that the caller is authenticated and that
// the request body carries a well-formed buyer address, a positive face value
// and a due date. It performs no I/O, so it is unit-testable on its own.
func validateCreateInvoiceRequest(ctx context.Context, body createInvoiceRequest) (*createInvoiceParams, error) {
	issuer, ok := GetUserAddress(ctx)
	if !ok || issuer == "" {
		return nil, httpErrorf(http.StatusUnauthorized, "Unauthorized: user address missing from context")
	}

	if body.Buyer == "" || body.FaceValue == "" || body.DueDate <= 0 {
		return nil, httpErrorf(http.StatusBadRequest, "missing required invoice parameters")
	}

	if _, err := keypair.Parse(body.Buyer); err != nil {
		return nil, httpErrorf(http.StatusBadRequest, "invalid buyer address")
	}

	faceValueBig, ok := new(big.Int).SetString(body.FaceValue, 10)
	if !ok || faceValueBig.Sign() <= 0 {
		return nil, httpErrorf(http.StatusBadRequest, "invalid face value")
	}

	return &createInvoiceParams{
		Issuer:    issuer,
		Buyer:     body.Buyer,
		FaceValue: faceValueBig,
		DueDate:   uint64(body.DueDate),
	}, nil
}

// buildCreateInvoiceTx fetches the server account sequence, assembles the
// invoke-host-function transaction, simulates it to obtain the Soroban resource
// footprint and the generated invoice ID, and returns the signed envelope.
func (h *APIHandler) buildCreateInvoiceTx(ctx context.Context, params *createInvoiceParams) (signedTx string, invoiceID string, err error) {
	seq, err := h.fetchServerSequence(ctx)
	if err != nil {
		return "", "", err
	}

	op, err := buildCreateInvoiceOp(h.cfg.InvoiceContractID, params)
	if err != nil {
		return "", "", err
	}

	tx, err := txnbuild.NewTransaction(txnbuild.TransactionParams{
		SourceAccount: &txnbuild.SimpleAccount{
			AccountID: h.serverKP.Address(),
			Sequence:  seq,
		},
		IncrementSequenceNum: true,
		BaseFee:              txnbuild.MinBaseFee,
		Preconditions: txnbuild.Preconditions{
			TimeBounds: txnbuild.NewTimebounds(0, time.Now().Add(1*time.Hour).Unix()),
		},
		Operations: []txnbuild.Operation{op},
	})
	if err != nil {
		return "", "", httpErrorf(http.StatusInternalServerError, "failed to construct transaction")
	}

	txBase64, err := tx.Base64()
	if err != nil {
		return "", "", httpErrorf(http.StatusInternalServerError, "failed to encode transaction to base64")
	}

	simResp, invoiceID, err := h.simulateCreateInvoiceTx(ctx, txBase64)
	if err != nil {
		return "", "", err
	}

	signedTx, err = h.signCreateInvoiceTx(tx, txBase64, simResp)
	if err != nil {
		return "", "", err
	}

	return signedTx, invoiceID, nil
}

// fetchServerSequence reads the current sequence number of the server account
// from Soroban RPC.
func (h *APIHandler) fetchServerSequence(ctx context.Context) (int64, error) {
	var accResp soroban.GetAccountResponse
	if err := soroban.CallSorobanRPC(ctx, h.cfg.SorobanRPCURL, "getAccount", map[string]string{"address": h.serverKP.Address()}, &accResp); err != nil {
		return 0, httpErrorf(http.StatusInternalServerError, "failed to fetch server account: %s", err.Error())
	}

	seq, err := strconv.ParseInt(accResp.Sequence, 10, 64)
	if err != nil {
		return 0, httpErrorf(http.StatusInternalServerError, "failed to parse sequence number")
	}
	return seq, nil
}

// buildCreateInvoiceOp converts the validated params into the invoice
// contract's `create` invocation.
func buildCreateInvoiceOp(contractID string, params *createInvoiceParams) (*txnbuild.InvokeHostFunction, error) {
	issuerVal, err := soroban.MakeAddressScVal(params.Issuer)
	if err != nil {
		return nil, httpErrorf(http.StatusInternalServerError, "failed to build issuer address")
	}
	buyerVal, err := soroban.MakeAddressScVal(params.Buyer)
	if err != nil {
		return nil, httpErrorf(http.StatusInternalServerError, "failed to build buyer address")
	}
	faceValueVal := soroban.MakeU128ScVal(params.FaceValue)
	dueDateVal := soroban.MakeU64ScVal(params.DueDate)

	op, err := soroban.BuildInvokeContractOp(contractID, "create", []xdr.ScVal{issuerVal, buyerVal, faceValueVal, dueDateVal})
	if err != nil {
		return nil, httpErrorf(http.StatusInternalServerError, "failed to build contract operation")
	}
	return op, nil
}

// simulateCreateInvoiceTx simulates txBase64 and returns the simulation
// response together with the invoice ID the contract would generate.
func (h *APIHandler) simulateCreateInvoiceTx(ctx context.Context, txBase64 string) (*soroban.SimulateResponse, string, error) {
	var simResp soroban.SimulateResponse
	if err := soroban.CallSorobanRPC(ctx, h.cfg.SorobanRPCURL, "simulateTransaction", map[string]string{"transaction": txBase64}, &simResp); err != nil {
		return nil, "", httpErrorf(http.StatusInternalServerError, "simulation failed: %s", err.Error())
	}

	if len(simResp.Results) == 0 {
		return nil, "", httpErrorf(http.StatusInternalServerError, "simulation did not yield a result")
	}

	invoiceID, err := soroban.ParseInvoiceIDFromResult(simResp.Results[0].Xdr)
	if err != nil {
		return nil, "", httpErrorf(http.StatusInternalServerError, "failed to parse generated invoice id: %s", err.Error())
	}

	return &simResp, invoiceID, nil
}

// signCreateInvoiceTx grafts the simulated Soroban transaction data and
// resource fee onto the envelope, then signs it with the server keypair.
func (h *APIHandler) signCreateInvoiceTx(tx *txnbuild.Transaction, txBase64 string, simResp *soroban.SimulateResponse) (string, error) {
	// Read and modify the envelope for Soroban Data and Fee
	var env xdr.TransactionEnvelope
	if err := xdr.SafeUnmarshalBase64(txBase64, &env); err != nil {
		return "", httpErrorf(http.StatusInternalServerError, "failed to unmarshal tx envelope")
	}

	var txData xdr.SorobanTransactionData
	if err := xdr.SafeUnmarshalBase64(simResp.TransactionData, &txData); err != nil {
		return "", httpErrorf(http.StatusInternalServerError, "failed to unmarshal simulation transaction data")
	}

	env.V1.Tx.Ext.V = 1
	env.V1.Tx.Ext.SorobanData = &txData

	resFee, err := strconv.ParseInt(simResp.MinResourceFee, 10, 64)
	if err != nil {
		return "", httpErrorf(http.StatusInternalServerError, "failed to parse resource fee")
	}
	env.V1.Tx.Fee = xdr.Uint32(tx.BaseFee() + resFee)

	// Marshal env back to base64
	envBytes, err := env.MarshalBinary()
	if err != nil {
		return "", httpErrorf(http.StatusInternalServerError, "failed to marshal modified envelope")
	}
	envBase64 := base64.StdEncoding.EncodeToString(envBytes)

	// Parse back as a Transaction to sign
	genericTx, err := txnbuild.TransactionFromXDR(envBase64)
	if err != nil {
		return "", httpErrorf(http.StatusInternalServerError, "failed to parse modified transaction envelope")
	}
	assembled, ok := genericTx.Transaction()
	if !ok {
		return "", httpErrorf(http.StatusInternalServerError, "invalid transaction envelope")
	}

	assembled, err = assembled.Sign(h.cfg.NetworkPassphrase, h.serverKP)
	if err != nil {
		return "", httpErrorf(http.StatusInternalServerError, "failed to sign transaction")
	}

	signedBase64, err := assembled.Base64()
	if err != nil {
		return "", httpErrorf(http.StatusInternalServerError, "failed to encode signed transaction")
	}

	return signedBase64, nil
}

// submitAndConfirm sends the signed transaction to the network and polls
// getTransaction until it reaches a terminal state, returning the transaction
// hash and final status.
func (h *APIHandler) submitAndConfirm(ctx context.Context, signedTx string) (hash string, status string, err error) {
	var submitResp struct {
		Hash   string `json:"hash"`
		Status string `json:"status"`
		Error  string `json:"error"`
	}
	if err := soroban.CallSorobanRPC(ctx, h.cfg.SorobanRPCURL, "sendTransaction", map[string]string{"transaction": signedTx}, &submitResp); err != nil {
		return "", "", httpErrorf(http.StatusInternalServerError, "failed to send transaction: %s", err.Error())
	}

	if submitResp.Status == "ERROR" {
		return "", "", httpErrorf(http.StatusInternalServerError, "transaction submission rejected: %s", submitResp.Error)
	}

	finalStatus, err := h.awaitTransaction(ctx, submitResp.Hash)
	if err != nil {
		return "", "", err
	}

	return submitResp.Hash, finalStatus, nil
}

// awaitTransaction polls getTransaction for hash until it succeeds, fails, or
// the attempt budget / request context runs out.
func (h *APIHandler) awaitTransaction(ctx context.Context, hash string) (string, error) {
	type getTransactionResult struct {
		Hash   string `json:"hash"`
		Status string `json:"status"`
		Error  string `json:"error"`
	}

	var txResult getTransactionResult
	pollAttempts := 0

	for {
		if err := soroban.CallSorobanRPC(ctx, h.cfg.SorobanRPCURL, "getTransaction", map[string]string{"hash": hash}, &txResult); err != nil {
			return "", httpErrorf(http.StatusInternalServerError, "failed to poll transaction: %s", err.Error())
		}

		if txResult.Status == "SUCCESS" {
			return txResult.Status, nil
		}

		if txResult.Status == "FAILED" {
			if txResult.Error != "" {
				return "", httpErrorf(http.StatusInternalServerError, "transaction failed on-chain: %s", txResult.Error)
			}
			return "", httpErrorf(http.StatusInternalServerError, "transaction failed on-chain")
		}

		pollAttempts++
		if pollAttempts >= maxPollAttempts {
			return "", httpErrorf(http.StatusGatewayTimeout, "transaction confirmation timed out after %d attempts: %s", maxPollAttempts, hash)
		}

		select {
		case <-ctx.Done():
			return "", httpErrorf(http.StatusGatewayTimeout, "request cancelled: %s", ctx.Err().Error())
		case <-time.After(createInvoicePollDelay):
		}
	}
}
