package listener

import (
	"context"
	"encoding/base64"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"trusttrove/indexer/config"
	"trusttrove/indexer/db"
	"trusttrove/indexer/webhook"
	"trusttrove/indexer/webhooks"

	"github.com/stellar/go-stellar-sdk/keypair"
	"github.com/stellar/go-stellar-sdk/strkey"
	"github.com/stellar/go-stellar-sdk/xdr"
)

// skipIfNoDB skips the test when TEST_DATABASE_URL is not set.
func skipIfNoDB(t *testing.T) {
	t.Helper()
	if os.Getenv("TEST_DATABASE_URL") == "" {
		t.Skip("TEST_DATABASE_URL not set â€” skipping DB integration test")
	}
}

func TestMain(m *testing.M) {
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL != "" {
		ctx := context.Background()
		if err := db.InitDB(ctx, dbURL); err != nil {
			fmt.Fprintf(os.Stderr, "failed to init test DB: %v\n", err)
			os.Exit(1)
		}
	}
	os.Exit(m.Run())
}

// newTestListener builds a minimal EventListener for handler tests.
func newTestListener() *EventListener {
	serverKP, err := keypair.Random()
	if err != nil {
		panic(err)
	}
	return &EventListener{
		cfg: &config.Config{
			SorobanRPCURL:     "http://localhost:8001",
			PoolContractID:    "CAKEWH7SJCXGV2MH2WZYIX3QDPTSSBQFXYVYBOWAGLNBBZMPLE2US6CS",
			JWTSecret:         "test-listener-secret",
			ServerSeed:        serverKP.Seed(),
			NetworkPassphrase: "Test SDF Network ; September 2015",
		},
	}
}

// encodeSymbol returns a base64-encoded XDR ScVal symbol.
func encodeSymbol(sym string) string {
	s := xdr.ScSymbol(sym)
	val := xdr.ScVal{Type: xdr.ScValTypeScvSymbol, Sym: &s}
	b, _ := val.MarshalBinary()
	return base64.StdEncoding.EncodeToString(b)
}

// encodeScVal marshals an xdr.ScVal to a base64-encoded string.
func encodeScVal(val xdr.ScVal) string {
	b, _ := val.MarshalBinary()
	return base64.StdEncoding.EncodeToString(b)
}

// makeAccountAddressScVal builds an address ScVal from a Stellar account address.
func makeAccountAddressScVal(address string) xdr.ScVal {
	raw, _ := strkey.Decode(strkey.VersionByteAccountID, address)
	var uint256 xdr.Uint256
	copy(uint256[:], raw)
	accountId := xdr.AccountId{
		Type:    xdr.PublicKeyTypePublicKeyTypeEd25519,
		Ed25519: &uint256,
	}
	scAddr := xdr.ScAddress{
		Type:      xdr.ScAddressTypeScAddressTypeAccount,
		AccountId: &accountId,
	}
	return xdr.ScVal{Type: xdr.ScValTypeScvAddress, Address: &scAddr}
}

// makeInvoiceCreatedValue builds the base64-encoded XDR ScVal map for handleInvoiceCreated.
// rawIDBytes are stored as-is; the handler extracts them via ParseBytes (returns hex string).
func makeInvoiceCreatedValue(rawIDBytes []byte, issuer, buyer string, faceValue, dueDate uint64) string {
	invoiceIDScBytes := xdr.ScBytes(rawIDBytes)
	faceValParts := xdr.UInt128Parts{Hi: 0, Lo: xdr.Uint64(faceValue)}
	dueDateU64 := xdr.Uint64(dueDate)

	syms := [5]xdr.ScSymbol{
		xdr.ScSymbol("id"),
		xdr.ScSymbol("issuer"),
		xdr.ScSymbol("buyer"),
		xdr.ScSymbol("face_value"),
		xdr.ScSymbol("due_date"),
	}
	scMap := xdr.ScMap{
		{
			Key: xdr.ScVal{Type: xdr.ScValTypeScvSymbol, Sym: &syms[0]},
			Val: xdr.ScVal{Type: xdr.ScValTypeScvBytes, Bytes: &invoiceIDScBytes},
		},
		{
			Key: xdr.ScVal{Type: xdr.ScValTypeScvSymbol, Sym: &syms[1]},
			Val: makeAccountAddressScVal(issuer),
		},
		{
			Key: xdr.ScVal{Type: xdr.ScValTypeScvSymbol, Sym: &syms[2]},
			Val: makeAccountAddressScVal(buyer),
		},
		{
			Key: xdr.ScVal{Type: xdr.ScValTypeScvSymbol, Sym: &syms[3]},
			Val: xdr.ScVal{Type: xdr.ScValTypeScvU128, U128: &faceValParts},
		},
		{
			Key: xdr.ScVal{Type: xdr.ScValTypeScvSymbol, Sym: &syms[4]},
			Val: xdr.ScVal{Type: xdr.ScValTypeScvU64, U64: &dueDateU64},
		},
	}
	inner := &scMap
	mapVal := xdr.ScVal{Type: xdr.ScValTypeScvMap, Map: &inner}
	return encodeScVal(mapVal)
}

// makeU128PairValue builds the base64-encoded XDR for the (amount, shares)
// tuple pool deposit and withdraw events publish as an ScVec of two u128s.
func makeU128PairValue(primary, secondary uint64) string {
	primaryParts := xdr.UInt128Parts{Hi: 0, Lo: xdr.Uint64(primary)}
	secondaryParts := xdr.UInt128Parts{Hi: 0, Lo: xdr.Uint64(secondary)}
	primaryVal := xdr.ScVal{Type: xdr.ScValTypeScvU128, U128: &primaryParts}
	secondaryVal := xdr.ScVal{Type: xdr.ScValTypeScvU128, U128: &secondaryParts}
	vec := xdr.ScVec{primaryVal, secondaryVal}
	inner := &vec
	return encodeScVal(xdr.ScVal{Type: xdr.ScValTypeScvVec, Vec: &inner})
}

// recordingDispatcher captures the fan-out handleEvent performs so tests can
// assert an event actually reached the webhook enqueue path without needing
// webhook_subscriptions rows.
type recordingDispatcher struct {
	calls     int
	eventType string
	data      map[string]interface{}
}

func (r *recordingDispatcher) Dispatch(_ context.Context, eventType string, data map[string]interface{}) {
	r.calls++
	r.eventType = eventType
	r.data = data
}

func (r *recordingDispatcher) EnqueueDeliveries(_ context.Context, _ db.Querier, eventType string, data map[string]interface{}) error {
	r.calls++
	r.eventType = eventType
	r.data = data
	return nil
}

// poolDepositEvent builds a synthetic pool deposit event in the shape
// contracts/pool/src/events.rs publishes: topics ["lp_deposited", lp_address]
// and value (usdc_amount, shares_issued).
func poolDepositEvent(t *testing.T, id string, lp string, amount, shares uint64) SorobanEvent {
	t.Helper()
	return SorobanEvent{
		ID:             id,
		ContractID:     "CAKEWH7SJCXGV2MH2WZYIX3QDPTSSBQFXYVYBOWAGLNBBZMPLE2US6CS",
		Ledger:         1300,
		LedgerClosedAt: time.Now().Format(time.RFC3339),
		Topic: []string{
			encodeSymbol("lp_deposited"),
			encodeScVal(makeAccountAddressScVal(lp)),
		},
		Value: makeU128PairValue(amount, shares),
	}
}

// TestHandlePoolDepositParsesLPFields covers the parsing half of issue #878
// without a database: the LP address and both u128s must land in the logData
// the handleEvent tail persists and dispatches.
func TestHandlePoolDepositParsesLPFields(t *testing.T) {
	l := newTestListener()
	const lp = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"

	event := poolDepositEvent(t, "event-pool-deposit-parse", lp, 2_500_000_000, 2_495_000_000)
	logData := map[string]interface{}{}

	if err := l.handlePoolDeposit(event, logData); err != nil {
		t.Fatalf("handlePoolDeposit: %v", err)
	}
	if logData["account"] != lp {
		t.Errorf("account: got %v, want %q", logData["account"], lp)
	}
	if logData["amount"] != "2500000000" {
		t.Errorf("amount: got %v, want %q", logData["amount"], "2500000000")
	}
	if logData["shares"] != "2495000000" {
		t.Errorf("shares: got %v, want %q", logData["shares"], "2495000000")
	}
}

// TestHandlePoolWithdrawalParsesLPFields is the mirror test for withdraw:
// same topic/value shape, shares_burned in the second tuple slot.
func TestHandlePoolWithdrawalParsesLPFields(t *testing.T) {
	l := newTestListener()
	// The shared "buyer" fixture in this file is a 55-char string that is not
	// a valid strkey, so generate a real address for the LP.
	lpKP, err := keypair.Random()
	if err != nil {
		t.Fatalf("keypair.Random: %v", err)
	}
	lp := lpKP.Address()

	event := SorobanEvent{
		ID:             "event-pool-withdraw-parse",
		ContractID:     "CAKEWH7SJCXGV2MH2WZYIX3QDPTSSBQFXYVYBOWAGLNBBZMPLE2US6CS",
		Ledger:         1301,
		LedgerClosedAt: time.Now().Format(time.RFC3339),
		Topic: []string{
			encodeSymbol("lp_withdrawn"),
			encodeScVal(makeAccountAddressScVal(lp)),
		},
		Value: makeU128PairValue(750_000_000, 748_000_000),
	}
	logData := map[string]interface{}{}

	if err := l.handlePoolWithdrawal(event, logData); err != nil {
		t.Fatalf("handlePoolWithdrawal: %v", err)
	}
	if logData["account"] != lp {
		t.Errorf("account: got %v, want %q", logData["account"], lp)
	}
	if logData["amount"] != "750000000" {
		t.Errorf("amount: got %v, want %q", logData["amount"], "750000000")
	}
	if logData["shares"] != "748000000" {
		t.Errorf("shares: got %v, want %q", logData["shares"], "748000000")
	}
}

// TestHandlePoolYieldDistributedParsesAmounts covers receive_repayment's
// (amount, lp_yield, protocol_cut) tuple: amount and yield_amount feed the
// pool.yield_distributed envelope and the protocol's cut is ignored.
func TestHandlePoolYieldDistributedParsesAmounts(t *testing.T) {
	l := newTestListener()

	// receive_repayment publishes (amount, lp_yield, protocol_cut); the third
	// element must be ignored â€” the envelope has no field for it.
	amountParts := xdr.UInt128Parts{Hi: 0, Lo: xdr.Uint64(1_050_000_000)}
	yieldParts := xdr.UInt128Parts{Hi: 0, Lo: xdr.Uint64(35_000_000)}
	cutParts := xdr.UInt128Parts{Hi: 0, Lo: xdr.Uint64(5_000_000)}
	amountVal := xdr.ScVal{Type: xdr.ScValTypeScvU128, U128: &amountParts}
	yieldVal := xdr.ScVal{Type: xdr.ScValTypeScvU128, U128: &yieldParts}
	cutVal := xdr.ScVal{Type: xdr.ScValTypeScvU128, U128: &cutParts}
	vec := xdr.ScVec{amountVal, yieldVal, cutVal}
	inner := &vec

	rawIDBytes := []byte("yield-invoice-id-32-bytes-000000")
	idScBytes := xdr.ScBytes(rawIDBytes)
	idTopic := encodeScVal(xdr.ScVal{Type: xdr.ScValTypeScvBytes, Bytes: &idScBytes})

	event := SorobanEvent{
		ID:             "event-pool-yield-parse",
		ContractID:     "CAKEWH7SJCXGV2MH2WZYIX3QDPTSSBQFXYVYBOWAGLNBBZMPLE2US6CS",
		Ledger:         1302,
		LedgerClosedAt: time.Now().Format(time.RFC3339),
		Topic: []string{
			encodeSymbol("repayment_received"),
			idTopic,
		},
		Value: encodeScVal(xdr.ScVal{Type: xdr.ScValTypeScvVec, Vec: &inner}),
	}
	logData := map[string]interface{}{}

	if err := l.handlePoolYieldDistributed(event, logData); err != nil {
		t.Fatalf("handlePoolYieldDistributed: %v", err)
	}
	if logData["amount"] != "1050000000" {
		t.Errorf("amount: got %v, want %q", logData["amount"], "1050000000")
	}
	if logData["yield_amount"] != "35000000" {
		t.Errorf("yield_amount: got %v, want %q", logData["yield_amount"], "35000000")
	}
}

// TestHandlePoolDepositLoggedAndDispatched covers issue #878's acceptance
// criteria end to end: a synthetic pool deposit must be persisted to
// events_log and must reach the webhook dispatcher with data that builds the
// pool.* envelope the webhook layer already supports. Before the fix the event
// fell into handleEvent's default branch and was silently dropped.
func TestHandlePoolDepositLoggedAndDispatched(t *testing.T) {
	skipIfNoDB(t)

	l := newTestListener()
	rec := &recordingDispatcher{}
	l.dispatcher = rec
	ctx := context.Background()

	const lp = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
	eventID := fmt.Sprintf("event-pool-deposit-%d", time.Now().UnixNano())
	t.Cleanup(func() {
		if db.Pool != nil {
			_, _ = db.Pool.Exec(ctx, "DELETE FROM events_log WHERE event_id = $1", eventID)
		}
	})

	event := poolDepositEvent(t, eventID, lp, 2_500_000_000, 2_495_000_000)
	if err := l.handleEvent(ctx, event); err != nil {
		t.Fatalf("handleEvent(lp_deposited): %v", err)
	}

	// 1. Logged: the events_log row marks the event processed.
	processed, err := db.IsEventProcessed(ctx, eventID)
	if err != nil {
		t.Fatalf("IsEventProcessed: %v", err)
	}
	if !processed {
		t.Fatal("pool deposit was not persisted to events_log â€” expected it to be handled, not skipped")
	}

	// 2. Dispatched: exactly one fan-out carrying the LP payload.
	if rec.calls != 1 {
		t.Fatalf("dispatcher calls: got %d, want 1", rec.calls)
	}
	if rec.eventType != "lp_deposited" {
		t.Errorf("dispatched event type: got %q, want %q", rec.eventType, "lp_deposited")
	}
	if rec.data["account"] != lp {
		t.Errorf("dispatched account: got %v, want %q", rec.data["account"], lp)
	}
	if rec.data["amount"] != "2500000000" {
		t.Errorf("dispatched amount: got %v, want %q", rec.data["amount"], "2500000000")
	}
	if rec.data["shares"] != "2495000000" {
		t.Errorf("dispatched shares: got %v, want %q", rec.data["shares"], "2495000000")
	}

	// 3. The dispatched name and data build the pool.deposit envelope the
	//    webhook package already implements.
	env, err := webhook.BuildEnvelope(rec.eventType, rec.data)
	if err != nil {
		t.Fatalf("BuildEnvelope: %v", err)
	}
	if env.EventType != webhooks.EventPoolDeposit {
		t.Errorf("envelope event type: got %q, want %q", env.EventType, webhooks.EventPoolDeposit)
	}
}

// TestHandlePoolWithdrawalLoggedAndDispatched is the withdraw mirror of the
// deposit test above: logged in events_log, dispatched once, and mapped to
// the existing pool.withdrawal envelope.
func TestHandlePoolWithdrawalLoggedAndDispatched(t *testing.T) {
	skipIfNoDB(t)

	l := newTestListener()
	rec := &recordingDispatcher{}
	l.dispatcher = rec
	ctx := context.Background()

	lpKP, err := keypair.Random()
	if err != nil {
		t.Fatalf("keypair.Random: %v", err)
	}
	lp := lpKP.Address()
	eventID := fmt.Sprintf("event-pool-withdraw-%d", time.Now().UnixNano())
	t.Cleanup(func() {
		if db.Pool != nil {
			_, _ = db.Pool.Exec(ctx, "DELETE FROM events_log WHERE event_id = $1", eventID)
		}
	})

	event := SorobanEvent{
		ID:             eventID,
		ContractID:     "CAKEWH7SJCXGV2MH2WZYIX3QDPTSSBQFXYVYBOWAGLNBBZMPLE2US6CS",
		Ledger:         1301,
		LedgerClosedAt: time.Now().Format(time.RFC3339),
		Topic: []string{
			encodeSymbol("lp_withdrawn"),
			encodeScVal(makeAccountAddressScVal(lp)),
		},
		Value: makeU128PairValue(750_000_000, 748_000_000),
	}
	if err := l.handleEvent(ctx, event); err != nil {
		t.Fatalf("handleEvent(lp_withdrawn): %v", err)
	}

	processed, err := db.IsEventProcessed(ctx, eventID)
	if err != nil {
		t.Fatalf("IsEventProcessed: %v", err)
	}
	if !processed {
		t.Fatal("pool withdrawal was not persisted to events_log â€” expected it to be handled, not skipped")
	}

	if rec.calls != 1 {
		t.Fatalf("dispatcher calls: got %d, want 1", rec.calls)
	}
	if rec.eventType != "lp_withdrawn" {
		t.Errorf("dispatched event type: got %q, want %q", rec.eventType, "lp_withdrawn")
	}
	if rec.data["account"] != lp {
		t.Errorf("dispatched account: got %v, want %q", rec.data["account"], lp)
	}
	if rec.data["amount"] != "750000000" {
		t.Errorf("dispatched amount: got %v, want %q", rec.data["amount"], "750000000")
	}
	if rec.data["shares"] != "748000000" {
		t.Errorf("dispatched shares: got %v, want %q", rec.data["shares"], "748000000")
	}

	env, err := webhook.BuildEnvelope(rec.eventType, rec.data)
	if err != nil {
		t.Fatalf("BuildEnvelope: %v", err)
	}
	if env.EventType != webhooks.EventPoolWithdrawal {
		t.Errorf("envelope event type: got %q, want %q", env.EventType, webhooks.EventPoolWithdrawal)
	}
}

func TestHandleInvoiceCreated(t *testing.T) {
	skipIfNoDB(t)

	l := newTestListener()
	ctx := context.Background()

	const (
		issuer = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
		buyer  = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN"
	)
	// rawIDBytes are the raw bytes; the handler stores their hex encoding as the DB id.
	rawIDBytes := []byte(fmt.Sprintf("created%d", time.Now().UnixNano()))
	invoiceIDHex := fmt.Sprintf("%x", rawIDBytes) // what the DB stores

	dueDate := uint64(time.Now().Add(30 * 24 * time.Hour).Unix())
	event := SorobanEvent{
		ID:             fmt.Sprintf("event-created-%d", time.Now().UnixNano()),
		ContractID:     "CAKEWH7SJCXGV2MH2WZYIX3QDPTSSBQFXYVYBOWAGLNBBZMPLE2US6CS",
		Ledger:         1000,
		LedgerClosedAt: time.Now().Format(time.RFC3339),
		Topic:          []string{encodeSymbol("create")},
		Value:          makeInvoiceCreatedValue(rawIDBytes, issuer, buyer, 1000000000, dueDate),
	}

	err := l.handleInvoiceCreated(ctx, db.Pool, event, time.Now().Unix())
	if err != nil {
		t.Fatalf("handleInvoiceCreated: %v", err)
	}
	t.Cleanup(func() {
		if db.Pool != nil {
			_, _ = db.Pool.Exec(ctx, "DELETE FROM invoices WHERE id = $1", invoiceIDHex)
		}
	})

	got, err := db.GetInvoiceByID(ctx, db.Pool, invoiceIDHex)
	if err != nil {
		t.Fatalf("GetInvoiceByID: %v", err)
	}
	if got == nil {
		t.Fatal("GetInvoiceByID: returned nil, want invoice record")
	}
	if got.Issuer != issuer {
		t.Errorf("Issuer: got %q, want %q", got.Issuer, issuer)
	}
	if got.Status != "Created" {
		t.Errorf("Status: got %q, want %q", got.Status, "Created")
	}
}

func TestHandleEventInvoiceCreatedDuplicate(t *testing.T) {
	skipIfNoDB(t)

	l := newTestListener()
	ctx := context.Background()
	const (
		issuer = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
		buyer  = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN"
	)
	rawIDBytes := []byte(fmt.Sprintf("%032x", time.Now().UnixNano()))
	invoiceID := fmt.Sprintf("%x", rawIDBytes)
	eventID := fmt.Sprintf("event-invoice-created-duplicate-%d", time.Now().UnixNano())
	event := SorobanEvent{
		ID:             eventID,
		ContractID:     "CAKEWH7SJCXGV2MH2WZYIX3QDPTSSBQFXYVYBOWAGLNBBZMPLE2US6CS",
		Ledger:         1001,
		LedgerClosedAt: time.Now().Format(time.RFC3339),
		Topic:          []string{encodeSymbol("InvoiceCreated")},
		Value:          makeInvoiceCreatedValue(rawIDBytes, issuer, buyer, 1_000_000_000, uint64(time.Now().Add(30*24*time.Hour).Unix())),
	}
	t.Cleanup(func() {
		if db.Pool != nil {
			_, _ = db.Pool.Exec(ctx, "DELETE FROM events_log WHERE event_id = $1", eventID)
			_, _ = db.Pool.Exec(ctx, "DELETE FROM invoices WHERE id = $1", invoiceID)
		}
	})

	for attempt := 1; attempt <= 2; attempt++ {
		if err := l.handleEvent(ctx, event); err != nil {
			t.Fatalf("handleEvent attempt %d: %v", attempt, err)
		}
	}

	var count int
	if err := db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM invoices WHERE id = $1", invoiceID).Scan(&count); err != nil {
		t.Fatalf("count invoice rows: %v", err)
	}
	if count != 1 {
		t.Errorf("invoice row count: got %d, want 1", count)
	}
}

func TestHandleInvoiceListed(t *testing.T) {
	skipIfNoDB(t)

	l := newTestListener()
	ctx := context.Background()

	const (
		issuer = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
		buyer  = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN"
	)
	// The raw bytes for the invoice ID. The handler stores hex(rawIDBytes) in the DB.
	rawIDBytes := []byte(fmt.Sprintf("listed%d", time.Now().UnixNano()))
	invoiceIDHex := fmt.Sprintf("%x", rawIDBytes)

	inv := &db.DbInvoice{
		ID:           invoiceIDHex, // must match what handler will look up
		Issuer:       issuer,
		Buyer:        buyer,
		FaceValue:    "1000000000",
		FundedAmount: "0",
		DueDate:      time.Now().Add(30 * 24 * time.Hour).Unix(),
		Status:       "Created",
		CreatedAt:    time.Now().Unix(),
	}
	if _, err := db.InsertInvoice(ctx, db.Pool, inv); err != nil {
		t.Fatalf("setup InsertInvoice: %v", err)
	}
	t.Cleanup(func() {
		if db.Pool != nil {
			_, _ = db.Pool.Exec(ctx, "DELETE FROM invoices WHERE id = $1", invoiceIDHex)
		}
	})

	// topic[1] carries the raw bytes; ParseBytes will produce invoiceIDHex
	idScBytes := xdr.ScBytes(rawIDBytes)
	idTopic := encodeScVal(xdr.ScVal{Type: xdr.ScValTypeScvBytes, Bytes: &idScBytes})
	discount := xdr.Uint32(500)
	discountVal := xdr.ScVal{Type: xdr.ScValTypeScvU32, U32: &discount}

	event := SorobanEvent{
		ID:             fmt.Sprintf("event-listed-%d", time.Now().UnixNano()),
		ContractID:     "CAKEWH7SJCXGV2MH2WZYIX3QDPTSSBQFXYVYBOWAGLNBBZMPLE2US6CS",
		Ledger:         1001,
		LedgerClosedAt: time.Now().Format(time.RFC3339),
		Topic:          []string{encodeSymbol("list_for_financing"), idTopic},
		Value:          encodeScVal(discountVal),
	}

	if err := l.handleInvoiceListed(ctx, db.Pool, event); err != nil {
		t.Fatalf("handleInvoiceListed: %v", err)
	}

	got, err := db.GetInvoiceByID(ctx, db.Pool, invoiceIDHex)
	if err != nil || got == nil {
		t.Fatalf("GetInvoiceByID after listing: err=%v, got=%v", err, got)
	}
	if got.Status != "Listed" {
		t.Errorf("Status after listing: got %q, want %q", got.Status, "Listed")
	}
	if got.DiscountBps != 500 {
		t.Errorf("DiscountBps after listing: got %d, want 500", got.DiscountBps)
	}
}

func TestHandleInvoiceShipped(t *testing.T) {
	skipIfNoDB(t)

	l := newTestListener()
	ctx := context.Background()

	const (
		issuer = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
		buyer  = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN"
	)
	rawIDBytes := []byte(fmt.Sprintf("shipped%d", time.Now().UnixNano()))
	invoiceIDHex := fmt.Sprintf("%x", rawIDBytes)

	inv := &db.DbInvoice{
		ID:           invoiceIDHex,
		Issuer:       issuer,
		Buyer:        buyer,
		FaceValue:    "1000000000",
		FundedAmount: "1000000000",
		DueDate:      time.Now().Add(30 * 24 * time.Hour).Unix(),
		Status:       "Funded",
		CreatedAt:    time.Now().Unix(),
	}
	if _, err := db.InsertInvoice(ctx, db.Pool, inv); err != nil {
		t.Fatalf("setup InsertInvoice: %v", err)
	}
	t.Cleanup(func() {
		if db.Pool != nil {
			_, _ = db.Pool.Exec(ctx, "DELETE FROM invoices WHERE id = $1", invoiceIDHex)
		}
	})

	idScBytes := xdr.ScBytes(rawIDBytes)
	idTopic := encodeScVal(xdr.ScVal{Type: xdr.ScValTypeScvBytes, Bytes: &idScBytes})
	event := SorobanEvent{
		ID:             fmt.Sprintf("event-shipped-%d", time.Now().UnixNano()),
		ContractID:     "CAKEWH7SJCXGV2MH2WZYIX3QDPTSSBQFXYVYBOWAGLNBBZMPLE2US6CS",
		Ledger:         1002,
		LedgerClosedAt: time.Now().Format(time.RFC3339),
		Topic:          []string{encodeSymbol("mark_shipped"), idTopic},
		Value:          encodeSymbol("mark_shipped"),
	}

	if err := l.handleInvoiceShipped(ctx, db.Pool, event, time.Now().Unix()); err != nil {
		t.Fatalf("handleInvoiceShipped: %v", err)
	}

	got, err := db.GetInvoiceByID(ctx, db.Pool, invoiceIDHex)
	if err != nil || got == nil {
		t.Fatalf("GetInvoiceByID after shipped: err=%v, got=%v", err, got)
	}
	if got.Status != "Active" {
		t.Errorf("Status after shipped: got %q, want %q", got.Status, "Active")
	}
}

func TestHandleDeliveryConfirmed(t *testing.T) {
	skipIfNoDB(t)

	l := newTestListener()
	ctx := context.Background()

	const (
		issuer = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
		buyer  = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN"
	)
	rawIDBytes := []byte(fmt.Sprintf("confirmed%d", time.Now().UnixNano()))
	invoiceIDHex := fmt.Sprintf("%x", rawIDBytes)

	inv := &db.DbInvoice{
		ID:           invoiceIDHex,
		Issuer:       issuer,
		Buyer:        buyer,
		FaceValue:    "1000000000",
		FundedAmount: "1000000000",
		DueDate:      time.Now().Add(30 * 24 * time.Hour).Unix(),
		Status:       "Active",
		CreatedAt:    time.Now().Unix(),
	}
	if _, err := db.InsertInvoice(ctx, db.Pool, inv); err != nil {
		t.Fatalf("setup InsertInvoice: %v", err)
	}
	t.Cleanup(func() {
		if db.Pool != nil {
			_, _ = db.Pool.Exec(ctx, "DELETE FROM invoices WHERE id = $1", invoiceIDHex)
		}
	})

	idScBytes := xdr.ScBytes(rawIDBytes)
	idTopic := encodeScVal(xdr.ScVal{Type: xdr.ScValTypeScvBytes, Bytes: &idScBytes})
	event := SorobanEvent{
		ID:             fmt.Sprintf("event-confirmed-%d", time.Now().UnixNano()),
		ContractID:     "CAKEWH7SJCXGV2MH2WZYIX3QDPTSSBQFXYVYBOWAGLNBBZMPLE2US6CS",
		Ledger:         1003,
		LedgerClosedAt: time.Now().Format(time.RFC3339),
		Topic:          []string{encodeSymbol("confirm_delivery"), idTopic},
		Value:          encodeSymbol("confirm_delivery"),
	}

	if err := l.handleDeliveryConfirmed(ctx, db.Pool, event, time.Now().Unix()); err != nil {
		t.Fatalf("handleDeliveryConfirmed: %v", err)
	}

	got, err := db.GetInvoiceByID(ctx, db.Pool, invoiceIDHex)
	if err != nil || got == nil {
		t.Fatalf("GetInvoiceByID after confirmed: err=%v, got=%v", err, got)
	}
	if got.Status != "Confirmed" {
		t.Errorf("Status after confirmed: got %q, want %q", got.Status, "Confirmed")
	}
}

func TestHandleAttestationSubmitted(t *testing.T) {
	skipIfNoDB(t)

	l := newTestListener()
	ctx := context.Background()

	const (
		issuer = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
		buyer  = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN"
	)
	rawIDBytes := []byte(fmt.Sprintf("attested%d", time.Now().UnixNano()))
	invoiceIDHex := fmt.Sprintf("%x", rawIDBytes)

	inv := &db.DbInvoice{
		ID:           invoiceIDHex,
		Issuer:       issuer,
		Buyer:        buyer,
		FaceValue:    "1000000000",
		FundedAmount: "0",
		DueDate:      time.Now().Add(30 * 24 * time.Hour).Unix(),
		Status:       "Created",
		CreatedAt:    time.Now().Unix(),
	}
	if _, err := db.InsertInvoice(ctx, db.Pool, inv); err != nil {
		t.Fatalf("setup InsertInvoice: %v", err)
	}
	t.Cleanup(func() {
		if db.Pool != nil {
			_, _ = db.Pool.Exec(ctx, "DELETE FROM invoices WHERE id = $1", invoiceIDHex)
		}
	})

	idScBytes := xdr.ScBytes(rawIDBytes)
	idTopic := encodeScVal(xdr.ScVal{Type: xdr.ScValTypeScvBytes, Bytes: &idScBytes})

	// agent_id as a symbol topic
	agentSymbol := xdr.ScSymbol("agent_underwrite")
	agentTopic := encodeScVal(xdr.ScVal{Type: xdr.ScValTypeScvSymbol, Sym: &agentSymbol})

	// risk_score = 2500 bps as u32 value
	riskScore := xdr.Uint32(2500)
	riskVal := xdr.ScVal{Type: xdr.ScValTypeScvU32, U32: &riskScore}

	event := SorobanEvent{
		ID:             fmt.Sprintf("event-attestation-%d", time.Now().UnixNano()),
		ContractID:     "CAKEWH7SJCXGV2MH2WZYIX3QDPTSSBQFXYVYBOWAGLNBBZMPLE2US6CS",
		Ledger:         1010,
		LedgerClosedAt: time.Now().Format(time.RFC3339),
		Topic:          []string{encodeSymbol("AttestationSubmitted"), idTopic, agentTopic},
		Value:          encodeScVal(riskVal),
	}

	if err := l.handleAttestationSubmitted(ctx, db.Pool, event, time.Now().Unix()); err != nil {
		t.Fatalf("handleAttestationSubmitted: %v", err)
	}

	got, err := db.GetInvoiceByID(ctx, db.Pool, invoiceIDHex)
	if err != nil || got == nil {
		t.Fatalf("GetInvoiceByID after attestation: err=%v, got=%v", err, got)
	}
	if got.AttestationAgentID == nil || *got.AttestationAgentID != "agent_underwrite" {
		t.Errorf("AttestationAgentID: got %v, want %q", got.AttestationAgentID, "agent_underwrite")
	}
	if got.RiskScoreBps == nil || *got.RiskScoreBps != 2500 {
		t.Errorf("RiskScoreBps: got %v, want %d", got.RiskScoreBps, 2500)
	}
}

func TestHandleAttestationSubmitted_ShortTopic(t *testing.T) {
	l := newTestListener()
	ctx := context.Background()

	// Event with only one topic element should fail
	event := SorobanEvent{
		ID:             "event-short-topic",
		ContractID:     "CAKEWH7SJCXGV2MH2WZYIX3QDPTSSBQFXYVYBOWAGLNBBZMPLE2US6CS",
		Ledger:         1011,
		LedgerClosedAt: time.Now().Format(time.RFC3339),
		Topic:          []string{encodeSymbol("AttestationSubmitted")},
		Value:          encodeScVal(xdr.ScVal{Type: xdr.ScValTypeScvVoid}),
	}

	err := l.handleAttestationSubmitted(ctx, db.Pool, event, time.Now().Unix())
	if err == nil {
		t.Fatal("expected error for short topic, got nil")
	}
}

// TestHandleIssuerRegistered verifies that a registry_contract
// `issuer_registered` event is persisted to events_log rather than dropped by
// the default skip branch.
func TestHandleIssuerRegistered(t *testing.T) {
	skipIfNoDB(t)

	l := newTestListener()
	ctx := context.Background()

	const issuer = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
	eventID := fmt.Sprintf("event-issuer-registered-%d", time.Now().UnixNano())
	t.Cleanup(func() {
		if db.Pool != nil {
			_, _ = db.Pool.Exec(ctx, "DELETE FROM events_log WHERE event_id = $1", eventID)
		}
	})

	event := SorobanEvent{
		ID:             eventID,
		ContractID:     "CAKEWH7SJCXGV2MH2WZYIX3QDPTSSBQFXYVYBOWAGLNBBZMPLE2US6CS",
		Ledger:         1100,
		LedgerClosedAt: time.Now().Format(time.RFC3339),
		Topic: []string{
			encodeSymbol("issuer_registered"),
			encodeScVal(makeAccountAddressScVal(issuer)),
		},
		Value: "",
	}

	if err := l.handleEvent(ctx, event); err != nil {
		t.Fatalf("handleEvent(issuer_registered): %v", err)
	}

	processed, err := db.IsEventProcessed(ctx, eventID)
	if err != nil {
		t.Fatalf("IsEventProcessed: %v", err)
	}
	if !processed {
		t.Fatal("issuer_registered event was skipped â€” expected it to be persisted in events_log")
	}
}

// TestHandleBuyerRegistered verifies the registry_contract buyer registration
// event (distinct topic) follows the same path.
func TestHandleBuyerRegistered(t *testing.T) {
	skipIfNoDB(t)

	l := newTestListener()
	ctx := context.Background()

	const buyer = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN"
	eventID := fmt.Sprintf("event-buyer-registered-%d", time.Now().UnixNano())
	t.Cleanup(func() {
		if db.Pool != nil {
			_, _ = db.Pool.Exec(ctx, "DELETE FROM events_log WHERE event_id = $1", eventID)
		}
	})

	event := SorobanEvent{
		ID:             eventID,
		ContractID:     "CAKEWH7SJCXGV2MH2WZYIX3QDPTSSBQFXYVYBOWAGLNBBZMPLE2US6CS",
		Ledger:         1101,
		LedgerClosedAt: time.Now().Format(time.RFC3339),
		Topic: []string{
			encodeSymbol("buyer_registered"),
			encodeScVal(makeAccountAddressScVal(buyer)),
		},
		Value: "",
	}

	if err := l.handleEvent(ctx, event); err != nil {
		t.Fatalf("handleEvent(buyer_registered): %v", err)
	}

	processed, err := db.IsEventProcessed(ctx, eventID)
	if err != nil {
		t.Fatalf("IsEventProcessed: %v", err)
	}
	if !processed {
		t.Fatal("buyer_registered event was skipped â€” expected it to be persisted in events_log")
	}
}

// TestHandleRegistrationEvent_ShortTopic verifies registrations with no address
// topic fail instead of being silently skipped.
func TestHandleRegistrationEvent_ShortTopic(t *testing.T) {
	l := newTestListener()
	ctx := context.Background()

	event := SorobanEvent{
		ID:             "event-registration-short-topic",
		ContractID:     "CAKEWH7SJCXGV2MH2WZYIX3QDPTSSBQFXYVYBOWAGLNBBZMPLE2US6CS",
		Ledger:         1102,
		LedgerClosedAt: time.Now().Format(time.RFC3339),
		Topic:          []string{encodeSymbol("issuer_registered")},
		Value:          "",
	}

	if err := l.handleEvent(ctx, event); err == nil {
		t.Fatal("expected error for registration event with no address topic, got nil")
	}
}

// TestHandleEventAtomicRollbackOnLogEventFailure covers issue #925's acceptance
// criterion: a failure after the invoice state change must leave neither the
// invoice update nor the events_log row behind. The forced failure is a real
// database error on the events_log insert â€” events_log.event_id is
// VARCHAR(128), so an over-length event id makes that statement fail after the
// UPDATE invoices statement in the same transaction has already succeeded.
func TestHandleEventAtomicRollbackOnLogEventFailure(t *testing.T) {
	skipIfNoDB(t)

	l := newTestListener()
	ctx := context.Background()

	const (
		issuer = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
		buyer  = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN"
	)
	rawIDBytes := []byte(fmt.Sprintf("rollback%d", time.Now().UnixNano()))
	invoiceIDHex := fmt.Sprintf("%x", rawIDBytes)

	inv := &db.DbInvoice{
		ID:           invoiceIDHex,
		Issuer:       issuer,
		Buyer:        buyer,
		FaceValue:    "1000000000",
		FundedAmount: "1000000000",
		DueDate:      time.Now().Add(30 * 24 * time.Hour).Unix(),
		Status:       "Funded",
		CreatedAt:    time.Now().Unix(),
	}
	if _, err := db.InsertInvoice(ctx, db.Pool, inv); err != nil {
		t.Fatalf("setup InsertInvoice: %v", err)
	}
	t.Cleanup(func() {
		if db.Pool != nil {
			_, _ = db.Pool.Exec(ctx, "DELETE FROM invoices WHERE id = $1", invoiceIDHex)
		}
	})

	idScBytes := xdr.ScBytes(rawIDBytes)
	idTopic := encodeScVal(xdr.ScVal{Type: xdr.ScValTypeScvBytes, Bytes: &idScBytes})

	// The event id exceeds events_log.event_id's VARCHAR(128): the invoice
	// UPDATE succeeds, then the events_log INSERT fails inside the same
	// transaction.
	oversizedEventID := strings.Repeat("x", 200)
	event := SorobanEvent{
		ID:             oversizedEventID,
		ContractID:     "CAKEWH7SJCXGV2MH2WZYIX3QDPTSSBQFXYVYBOWAGLNBBZMPLE2US6CS",
		Ledger:         1200,
		LedgerClosedAt: time.Now().Format(time.RFC3339),
		Topic:          []string{encodeSymbol("mark_shipped"), idTopic},
		Value:          encodeSymbol("mark_shipped"),
	}

	err := l.handleEvent(ctx, event)
	if err == nil {
		t.Fatal("expected handleEvent to return the LogEvent failure, got nil")
	}

	// The invoice state change must have been rolled back with the failed
	// events_log insert, not committed ahead of it.
	got, err := db.GetInvoiceByID(ctx, db.Pool, invoiceIDHex)
	if err != nil {
		t.Fatalf("GetInvoiceByID after rollback: %v", err)
	}
	if got == nil {
		t.Fatal("GetInvoiceByID: returned nil, want invoice record")
	}
	if got.Status != "Funded" {
		t.Errorf("Status after rolled-back event: got %q, want \"Funded\" (state change must not persist)", got.Status)
	}
	if got.ShippedAt != nil {
		t.Errorf("ShippedAt after rolled-back event: got %v, want nil", *got.ShippedAt)
	}
	if got.IssuerConfirmed {
		t.Error("IssuerConfirmed after rolled-back event: got true, want false")
	}

	// The events_log row must not exist either, so the event is eligible for
	// reprocessing rather than being marked processed without its effects.
	processed, err := db.IsEventProcessed(ctx, oversizedEventID)
	if err != nil {
		t.Fatalf("IsEventProcessed: %v", err)
	}
	if processed {
		t.Error("IsEventProcessed: got true, want false (events_log row must be rolled back)")
	}
}

// TestHandleEventCommitsStateAndLogTogether pins the complementary half of the
// #925 transaction: on success the invoice state change and the events_log row
// become visible together through the normal handleEvent path.
func TestHandleEventCommitsStateAndLogTogether(t *testing.T) {
	skipIfNoDB(t)

	l := newTestListener()
	ctx := context.Background()

	const (
		issuer = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
		buyer  = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN"
	)
	rawIDBytes := []byte(fmt.Sprintf("atomichappy%d", time.Now().UnixNano()))
	invoiceIDHex := fmt.Sprintf("%x", rawIDBytes)
	eventID := fmt.Sprintf("event-atomic-happy-%d", time.Now().UnixNano())

	t.Cleanup(func() {
		if db.Pool != nil {
			_, _ = db.Pool.Exec(ctx, "DELETE FROM invoices WHERE id = $1", invoiceIDHex)
			_, _ = db.Pool.Exec(ctx, "DELETE FROM events_log WHERE event_id = $1", eventID)
		}
	})

	inv := &db.DbInvoice{
		ID:           invoiceIDHex,
		Issuer:       issuer,
		Buyer:        buyer,
		FaceValue:    "1000000000",
		FundedAmount: "1000000000",
		DueDate:      time.Now().Add(30 * 24 * time.Hour).Unix(),
		Status:       "Funded",
		CreatedAt:    time.Now().Unix(),
	}
	if _, err := db.InsertInvoice(ctx, db.Pool, inv); err != nil {
		t.Fatalf("setup InsertInvoice: %v", err)
	}

	idScBytes := xdr.ScBytes(rawIDBytes)
	idTopic := encodeScVal(xdr.ScVal{Type: xdr.ScValTypeScvBytes, Bytes: &idScBytes})
	event := SorobanEvent{
		ID:             eventID,
		ContractID:     "CAKEWH7SJCXGV2MH2WZYIX3QDPTSSBQFXYVYBOWAGLNBBZMPLE2US6CS",
		Ledger:         1201,
		LedgerClosedAt: time.Now().Format(time.RFC3339),
		Topic:          []string{encodeSymbol("mark_shipped"), idTopic},
		Value:          encodeSymbol("mark_shipped"),
	}

	if err := l.handleEvent(ctx, event); err != nil {
		t.Fatalf("handleEvent(mark_shipped): %v", err)
	}

	got, err := db.GetInvoiceByID(ctx, db.Pool, invoiceIDHex)
	if err != nil || got == nil {
		t.Fatalf("GetInvoiceByID after commit: err=%v, got=%v", err, got)
	}
	if got.Status != "Active" {
		t.Errorf("Status after committed event: got %q, want %q", got.Status, "Active")
	}

	processed, err := db.IsEventProcessed(ctx, eventID)
	if err != nil {
		t.Fatalf("IsEventProcessed: %v", err)
	}
	if !processed {
		t.Error("IsEventProcessed: got false, want true (events_log row must commit with the state change)")
	}
}
