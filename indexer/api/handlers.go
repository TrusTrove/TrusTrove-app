package api

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"strconv"
	"sync"
	"time"

	"trusttrove/indexer/config"
	"trusttrove/indexer/db"
	"trusttrove/indexer/xdrutil"

	"github.com/go-chi/chi/v5"
	"github.com/golang-jwt/jwt/v5"
	"github.com/stellar/go-stellar-sdk/keypair"
	"github.com/stellar/go-stellar-sdk/strkey"
	"github.com/stellar/go-stellar-sdk/txnbuild"
	"github.com/stellar/go-stellar-sdk/xdr"
)

type APIHandler struct {
	cfg         *config.Config
	serverKP    *keypair.Full
	statsMu     sync.Mutex
	statsData   *db.ProtocolStats
	statsCached time.Time
}

func NewAPIHandler(cfg *config.Config) (*APIHandler, error) {
	kp, err := GetServerKeypair(cfg.JWTSecret)
	if err != nil {
		return nil, err
	}
	return &APIHandler{
		cfg:      cfg,
		serverKP: kp,
	}, nil
}

// GetServerKeypair derives a keypair deterministically from the JWT secret
func GetServerKeypair(jwtSecret string) (*keypair.Full, error) {
	hash := sha256.Sum256([]byte(jwtSecret))
	return keypair.FromRawSeed(hash)
}

type JsonRpcRequest struct {
	Jsonrpc string      `json:"jsonrpc"`
	Id      int         `json:"id"`
	Method  string      `json:"method"`
	Params  interface{} `json:"params"`
}

type JsonRpcResponse struct {
	Jsonrpc string          `json:"jsonrpc"`
	Id      int             `json:"id"`
	Result  json.RawMessage `json:"result"`
	Error   *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

func CallSorobanRPC(rpcURL string, method string, params interface{}, result interface{}) error {
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

	resp, err := http.Post(rpcURL, "application/json", bytes.NewBuffer(bodyBytes))
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

func ParseAddressToScAddress(addr string) (xdr.ScAddress, error) {
	if len(addr) == 56 && addr[0] == 'G' {
		rawBytes, err := strkey.Decode(strkey.VersionByteAccountID, addr)
		if err != nil {
			return xdr.ScAddress{}, err
		}
		var uint256 xdr.Uint256
		copy(uint256[:], rawBytes)

		accountId := xdr.AccountId{
			Type:    xdr.PublicKeyTypePublicKeyTypeEd25519,
			Ed25519: &uint256,
		}
		return xdr.ScAddress{
			Type:      xdr.ScAddressTypeScAddressTypeAccount,
			AccountId: &accountId,
		}, nil
	} else if len(addr) == 56 && addr[0] == 'C' {
		rawBytes, err := strkey.Decode(strkey.VersionByteContract, addr)
		if err != nil {
			return xdr.ScAddress{}, err
		}
		var contractId xdr.ContractId
		copy(contractId[:], rawBytes)
		return xdr.ScAddress{
			Type:       xdr.ScAddressTypeScAddressTypeContract,
			ContractId: &contractId,
		}, nil
	}
	return xdr.ScAddress{}, fmt.Errorf("invalid address format: %s", addr)
}

func MakeAddressScVal(addr string) (xdr.ScVal, error) {
	scAddress, err := ParseAddressToScAddress(addr)
	if err != nil {
		return xdr.ScVal{}, err
	}
	return xdr.ScVal{
		Type:    xdr.ScValTypeScvAddress,
		Address: &scAddress,
	}, nil
}

func MakeU128ScVal(val *big.Int) xdr.ScVal {
	hi := new(big.Int).Rsh(val, 64).Uint64()
	lo := new(big.Int).And(val, new(big.Int).SetUint64(0xffffffffffffffff)).Uint64()
	parts := xdr.UInt128Parts{
		Hi: xdr.Uint64(hi),
		Lo: xdr.Uint64(lo),
	}
	return xdr.ScVal{
		Type: xdr.ScValTypeScvU128,
		U128: &parts,
	}
}

func MakeU64ScVal(val uint64) xdr.ScVal {
	u64Val := xdr.Uint64(val)
	return xdr.ScVal{
		Type: xdr.ScValTypeScvU64,
		U64:  &u64Val,
	}
}

func BuildInvokeContractOp(contractID string, method string, args []xdr.ScVal) (*txnbuild.InvokeHostFunction, error) {
	contractAddress, err := ParseAddressToScAddress(contractID)
	if err != nil {
		return nil, err
	}

	symbolFunc := xdr.ScSymbol(method)
	hostFn := xdr.HostFunction{
		Type: xdr.HostFunctionTypeHostFunctionTypeInvokeContract,
		InvokeContract: &xdr.InvokeContractArgs{
			ContractAddress: contractAddress,
			FunctionName:    symbolFunc,
			Args:            args,
		},
	}

	return &txnbuild.InvokeHostFunction{
		HostFunction: hostFn,
	}, nil
}

type SimulateResponse struct {
	TransactionData string `json:"transactionData"`
	MinResourceFee  string `json:"minResourceFee"`
	Results         []struct {
		Xdr string `json:"xdr"`
	} `json:"results"`
}

type GetAccountResponse struct {
	ID       string `json:"id"`
	Sequence string `json:"sequence"`
}

func ReadContract(
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
	err = CallSorobanRPC(rpcURL, "simulateTransaction", map[string]string{"transaction": txBase64}, &simResp)
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

func ParseInvoiceIDFromResult(resultXDR string) (string, error) {
	var val xdr.ScVal
	err := xdr.SafeUnmarshalBase64(resultXDR, &val)
	if err != nil {
		return "", err
	}
	if val.Bytes == nil {
		return "", errors.New("result is not bytes")
	}
	return fmt.Sprintf("%x", *val.Bytes), nil
}

// GenerateChallenge constructs and signs a SEP-10 challenge transaction
func GenerateChallenge(serverKP *keypair.Full, clientAddr string, passphrase string) (string, error) {
	nonce := make([]byte, 48)
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	nonceStr := base64.StdEncoding.EncodeToString(nonce)

	tx, err := txnbuild.NewTransaction(txnbuild.TransactionParams{
		SourceAccount: &txnbuild.SimpleAccount{
			AccountID: serverKP.Address(),
			Sequence:  0,
		},
		IncrementSequenceNum: false,
		BaseFee:              txnbuild.MinBaseFee,
		Preconditions: txnbuild.Preconditions{
			TimeBounds: txnbuild.NewTimebounds(time.Now().Unix(), time.Now().Add(15*time.Minute).Unix()),
		},
		Operations: []txnbuild.Operation{
			&txnbuild.ManageData{
				SourceAccount: clientAddr,
				Name:          "trusttrove auth",
				Value:         []byte(nonceStr[:64]),
			},
		},
	})
	if err != nil {
		return "", err
	}

	tx, err = tx.Sign(passphrase, serverKP)
	if err != nil {
		return "", err
	}

	return tx.Base64()
}

// VerifyChallenge parses the signed transaction and checks the server and client signatures
func VerifyChallenge(signedXDR string, serverKP *keypair.Full, passphrase string) (string, error) {
	genericTx, err := txnbuild.TransactionFromXDR(signedXDR)
	if err != nil {
		return "", fmt.Errorf("failed to parse XDR: %w", err)
	}

	tx, ok := genericTx.Transaction()
	if !ok {
		return "", errors.New("invalid transaction type")
	}

	srcAcc := tx.SourceAccount()
	if srcAcc.AccountID != serverKP.Address() {
		return "", errors.New("invalid server source account")
	}

	if len(tx.Operations()) != 1 {
		return "", errors.New("must contain exactly one operation")
	}

	op, ok := tx.Operations()[0].(*txnbuild.ManageData)
	if !ok {
		return "", errors.New("operation must be ManageData")
	}

	clientAddr := op.SourceAccount
	if clientAddr == "" {
		return "", errors.New("client source account is empty")
	}

	if op.Name != "trusttrove auth" {
		return "", fmt.Errorf("invalid operation name: %s", op.Name)
	}

	tb := tx.Timebounds()
	if tb.MaxTime == 0 {
		return "", errors.New("timebounds must be set")
	}
	now := time.Now().Unix()
	if now < tb.MinTime || now > tb.MaxTime {
		return "", errors.New("challenge has expired or is not yet valid")
	}

	txHash, err := tx.Hash(passphrase)
	if err != nil {
		return "", fmt.Errorf("failed to get transaction hash: %w", err)
	}

	signatures := tx.Signatures()
	serverSigned := false
	clientSigned := false

	for _, sig := range signatures {
		serverKPCheck, _ := keypair.Parse(serverKP.Address())
		if err := serverKPCheck.Verify(txHash[:], sig.Signature); err == nil {
			serverSigned = true
			continue
		}

		clientKP, err := keypair.Parse(clientAddr)
		if err != nil {
			continue
		}
		if err := clientKP.Verify(txHash[:], sig.Signature); err == nil {
			clientSigned = true
		}
	}

	if !serverSigned {
		return "", errors.New("missing server signature")
	}
	if !clientSigned {
		return "", errors.New("missing client signature")
	}

	return clientAddr, nil
}

// GenerateJWT creates a JWT token signed by the server's secret
func GenerateJWT(address string, jwtSecret string, expiryHours int) (string, error) {
	claims := jwt.MapClaims{
		"sub": address,
		"exp": time.Now().Add(time.Duration(expiryHours) * time.Hour).Unix(),
		"iat": time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(jwtSecret))
}

// GET /auth
func (h *APIHandler) HandleGetAuth(w http.ResponseWriter, r *http.Request) {
	address := r.URL.Query().Get("address")
	if address == "" {
		http.Error(w, "missing address parameter", http.StatusBadRequest)
		return
	}

	_, err := keypair.Parse(address)
	if err != nil {
		http.Error(w, "invalid address format", http.StatusBadRequest)
		return
	}

	xdrString, err := GenerateChallenge(h.serverKP, address, h.cfg.NetworkPassphrase)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to generate challenge: %s", err.Error()), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"transaction":        xdrString,
		"network_passphrase": h.cfg.NetworkPassphrase,
	})
}

// POST /auth
func (h *APIHandler) HandlePostAuth(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Transaction string `json:"transaction"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if body.Transaction == "" {
		http.Error(w, "missing transaction parameter", http.StatusBadRequest)
		return
	}

	clientAddr, err := VerifyChallenge(body.Transaction, h.serverKP, h.cfg.NetworkPassphrase)
	if err != nil {
		http.Error(w, fmt.Sprintf("challenge verification failed: %s", err.Error()), http.StatusUnauthorized)
		return
	}

	token, err := GenerateJWT(clientAddr, h.cfg.JWTSecret, h.cfg.JWTExpiryHours)
	if err != nil {
		http.Error(w, "failed to generate authentication token", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"token": token,
	})
}

// POST /invoices (protected)
func (h *APIHandler) HandleCreateInvoice(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Buyer     string `json:"buyer"`
		FaceValue string `json:"face_value"`
		DueDate   int64  `json:"due_date"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	issuer := r.Context().Value("user_address").(string)

	if body.Buyer == "" || body.FaceValue == "" || body.DueDate <= 0 {
		http.Error(w, "missing required invoice parameters", http.StatusBadRequest)
		return
	}

	if _, err := keypair.Parse(body.Buyer); err != nil {
		http.Error(w, "invalid buyer address", http.StatusBadRequest)
		return
	}

	faceValueBig, ok := new(big.Int).SetString(body.FaceValue, 10)
	if !ok || faceValueBig.Sign() <= 0 {
		http.Error(w, "invalid face value", http.StatusBadRequest)
		return
	}

	var accResp GetAccountResponse
	err := CallSorobanRPC(h.cfg.SorobanRPCURL, "getAccount", map[string]string{"address": h.serverKP.Address()}, &accResp)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to fetch server account: %s", err.Error()), http.StatusInternalServerError)
		return
	}

	seq, err := strconv.ParseInt(accResp.Sequence, 10, 64)
	if err != nil {
		http.Error(w, "failed to parse sequence number", http.StatusInternalServerError)
		return
	}

	issuerVal, err := MakeAddressScVal(issuer)
	if err != nil {
		http.Error(w, "failed to build issuer address", http.StatusInternalServerError)
		return
	}
	buyerVal, err := MakeAddressScVal(body.Buyer)
	if err != nil {
		http.Error(w, "failed to build buyer address", http.StatusInternalServerError)
		return
	}
	faceValueVal := MakeU128ScVal(faceValueBig)
	dueDateVal := MakeU64ScVal(uint64(body.DueDate))

	op, err := BuildInvokeContractOp(h.cfg.InvoiceContractID, "create", []xdr.ScVal{issuerVal, buyerVal, faceValueVal, dueDateVal})
	if err != nil {
		http.Error(w, "failed to build contract operation", http.StatusInternalServerError)
		return
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
		http.Error(w, "failed to construct transaction", http.StatusInternalServerError)
		return
	}

	txBase64, err := tx.Base64()
	if err != nil {
		http.Error(w, "failed to encode transaction to base64", http.StatusInternalServerError)
		return
	}

	var simResp SimulateResponse
	err = CallSorobanRPC(h.cfg.SorobanRPCURL, "simulateTransaction", map[string]string{"transaction": txBase64}, &simResp)
	if err != nil {
		http.Error(w, fmt.Sprintf("simulation failed: %s", err.Error()), http.StatusInternalServerError)
		return
	}

	if len(simResp.Results) == 0 {
		http.Error(w, "simulation did not yield a result", http.StatusInternalServerError)
		return
	}

	invoiceID, err := ParseInvoiceIDFromResult(simResp.Results[0].Xdr)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to parse generated invoice id: %s", err.Error()), http.StatusInternalServerError)
		return
	}

	// Read and modify the envelope for Soroban Data and Fee
	var env xdr.TransactionEnvelope
	err = xdr.SafeUnmarshalBase64(txBase64, &env)
	if err != nil {
		http.Error(w, "failed to unmarshal tx envelope", http.StatusInternalServerError)
		return
	}

	var txData xdr.SorobanTransactionData
	err = xdr.SafeUnmarshalBase64(simResp.TransactionData, &txData)
	if err != nil {
		http.Error(w, "failed to unmarshal simulation transaction data", http.StatusInternalServerError)
		return
	}

	env.V1.Tx.Ext.V = 1
	env.V1.Tx.Ext.SorobanData = &txData

	resFee, err := strconv.ParseInt(simResp.MinResourceFee, 10, 64)
	if err != nil {
		http.Error(w, "failed to parse resource fee", http.StatusInternalServerError)
		return
	}
	env.V1.Tx.Fee = xdr.Uint32(tx.BaseFee() + resFee)

	// Marshal env back to base64
	envBytes, err := env.MarshalBinary()
	if err != nil {
		http.Error(w, "failed to marshal modified envelope", http.StatusInternalServerError)
		return
	}
	envBase64 := base64.StdEncoding.EncodeToString(envBytes)

	// Parse back as a Transaction to sign
	genericTx, err := txnbuild.TransactionFromXDR(envBase64)
	if err != nil {
		http.Error(w, "failed to parse modified transaction envelope", http.StatusInternalServerError)
		return
	}
	tx, ok = genericTx.Transaction()
	if !ok {
		http.Error(w, "invalid transaction envelope", http.StatusInternalServerError)
		return
	}

	tx, err = tx.Sign(h.cfg.NetworkPassphrase, h.serverKP)
	if err != nil {
		http.Error(w, "failed to sign transaction", http.StatusInternalServerError)
		return
	}

	signedBase64, err := tx.Base64()
	if err != nil {
		http.Error(w, "failed to encode signed transaction", http.StatusInternalServerError)
		return
	}

	var submitResp struct {
		Hash   string `json:"hash"`
		Status string `json:"status"`
		Error  string `json:"error"`
	}
	err = CallSorobanRPC(h.cfg.SorobanRPCURL, "sendTransaction", map[string]string{"transaction": signedBase64}, &submitResp)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to send transaction: %s", err.Error()), http.StatusInternalServerError)
		return
	}

	if submitResp.Status == "ERROR" {
		http.Error(w, fmt.Sprintf("transaction submission rejected: %s", submitResp.Error), http.StatusInternalServerError)
		return
	}

	type GetTransactionResult struct {
		Hash   string `json:"hash"`
		Status string `json:"status"`
		Error  string `json:"error"`
	}
	const maxPollAttempts = 30
	pollDelay := 1 * time.Second
	var txResult GetTransactionResult
	pollAttempts := 0

	for {
		err = CallSorobanRPC(h.cfg.SorobanRPCURL, "getTransaction", map[string]string{"hash": submitResp.Hash}, &txResult)
		if err != nil {
			http.Error(w, fmt.Sprintf("failed to poll transaction: %s", err.Error()), http.StatusInternalServerError)
			return
		}

		if txResult.Status == "SUCCESS" {
			break
		}

		if txResult.Status == "FAILED" {
			errMsg := "transaction failed on-chain"
			if txResult.Error != "" {
				errMsg = fmt.Sprintf("transaction failed on-chain: %s", txResult.Error)
			}
			http.Error(w, errMsg, http.StatusInternalServerError)
			return
		}

		pollAttempts++
		if pollAttempts >= maxPollAttempts {
			http.Error(w, fmt.Sprintf("transaction confirmation timed out after %d attempts: %s", maxPollAttempts, submitResp.Hash), http.StatusGatewayTimeout)
			return
		}

		time.Sleep(pollDelay)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{
		"invoice_id":       invoiceID,
		"transaction_hash": submitResp.Hash,
		"status":           txResult.Status,
	})
}

// GET /invoices/{id}
func (h *APIHandler) HandleGetInvoiceByID(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, "missing invoice id", http.StatusBadRequest)
		return
	}

	invoice, err := db.GetInvoiceByID(r.Context(), id)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to retrieve invoice: %s", err.Error()), http.StatusInternalServerError)
		return
	}

	if invoice == nil {
		http.Error(w, "invoice not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(invoice)
}

// GET /invoices
func (h *APIHandler) HandleGetInvoices(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	issuer := r.URL.Query().Get("issuer")

	// Parse pagination params
	page := 1
	limit := 20

	if pageStr := r.URL.Query().Get("page"); pageStr != "" {
		if v, err := strconv.Atoi(pageStr); err == nil && v >= 1 {
			page = v
		} else {
			http.Error(w, "invalid page parameter: must be a positive integer", http.StatusBadRequest)
			return
		}
	}

	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if v, err := strconv.Atoi(limitStr); err == nil && v >= 1 {
			if v > 100 {
				limit = 100
			} else {
				limit = v
			}
		} else {
			http.Error(w, "invalid limit parameter: must be a positive integer", http.StatusBadRequest)
			return
		}
	}

	offset := (page - 1) * limit

	invoices, total, err := db.GetInvoicesPage(r.Context(), status, issuer, limit, offset)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to retrieve invoices: %s", err.Error()), http.StatusInternalServerError)
		return
	}

	// Ensure data is always a JSON array, never null
	if invoices == nil {
		invoices = []*db.DbInvoice{}
	}

	totalPages := (total + limit - 1) / limit
	if totalPages < 1 {
		totalPages = 1
	}

	resp := map[string]interface{}{
		"data":       invoices,
		"total":      total,
		"page":       page,
		"limit":      limit,
		"totalPages": totalPages,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// GET /stats
func (h *APIHandler) HandleGetStats(w http.ResponseWriter, r *http.Request) {
	h.statsMu.Lock()
	if h.statsData != nil && time.Since(h.statsCached) < 30*time.Second {
		data := h.statsData
		h.statsMu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(data)
		return
	}
	h.statsMu.Unlock()

	stats, err := db.GetProtocolStats(r.Context())
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to retrieve protocol stats: %s", err.Error()), http.StatusInternalServerError)
		return
	}

	h.statsMu.Lock()
	h.statsData = stats
	h.statsCached = time.Now()
	h.statsMu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// GET /pool/stats
func (h *APIHandler) HandleGetPoolStats(w http.ResponseWriter, r *http.Request) {
	stats, err := db.GetPoolStats(r.Context())
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to retrieve pool statistics: %s", err.Error()), http.StatusInternalServerError)
		return
	}

	if stats == nil {
		stats = &db.DbPoolStats{
			TotalDeposits:         "0",
			TotalFunded:           "0",
			AvailableLiquidity:    "0",
			UtilizationRateBps:    0,
			TotalYieldDistributed: "0",
			ActiveInvoiceCount:    0,
			UpdatedAt:             time.Now(),
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// GET /events
func (h *APIHandler) HandleGetEvents(w http.ResponseWriter, r *http.Request) {
	limitStr := r.URL.Query().Get("limit")
	limit := 20
	if limitStr != "" {
		if parsed, err := strconv.Atoi(limitStr); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	events, err := db.GetRecentEvents(r.Context(), limit)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to retrieve events: %s", err.Error()), http.StatusInternalServerError)
		return
	}

	if events == nil {
		events = []*db.EventLog{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(events)
}

// GET /pool/position/{address}
func (h *APIHandler) HandleGetLPPosition(w http.ResponseWriter, r *http.Request) {
	address := chi.URLParam(r, "address")
	if address == "" {
		http.Error(w, "missing address parameter", http.StatusBadRequest)
		return
	}

	if _, err := keypair.Parse(address); err != nil {
		http.Error(w, "invalid address format", http.StatusBadRequest)
		return
	}

	addrVal, err := MakeAddressScVal(address)
	if err != nil {
		http.Error(w, "failed to build address ScVal", http.StatusInternalServerError)
		return
	}

	scValResult, err := ReadContract(h.cfg.SorobanRPCURL, h.cfg.PoolContractID, "get_lp_position", []xdr.ScVal{addrVal}, h.serverKP)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to read LP position from pool: %s", err.Error()), http.StatusInternalServerError)
		return
	}

	shares := "0"
	usdcValue := "0"
	yieldEarned := "0"
	depositCount := 0

	if val, ok := xdrutil.GetMapVal(scValResult, "shares"); ok {
		shares = xdrutil.ParseU128(val)
	}
	if val, ok := xdrutil.GetMapVal(scValResult, "usdc_value"); ok {
		usdcValue = xdrutil.ParseU128(val)
	}
	if val, ok := xdrutil.GetMapVal(scValResult, "yield_earned"); ok {
		yieldEarned = xdrutil.ParseU128(val)
	}
	if val, ok := xdrutil.GetMapVal(scValResult, "deposit_count"); ok {
		depositCount = int(xdrutil.ParseU32(val))
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"shares":        shares,
		"usdc_value":    usdcValue,
		"yield_earned":  yieldEarned,
		"deposit_count": depositCount,
	})
}
