package listener

import (
	"context"
	"encoding/base64"
	"fmt"
	"os"
	"testing"
	"time"

	"trusttrove/indexer/config"
	"trusttrove/indexer/db"

	"github.com/stellar/go-stellar-sdk/strkey"
	"github.com/stellar/go-stellar-sdk/xdr"
)

// skipIfNoDB skips the test when TEST_DATABASE_URL is not set.
func skipIfNoDB(t *testing.T) {
	t.Helper()
	if os.Getenv("TEST_DATABASE_URL") == "" {
		t.Skip("TEST_DATABASE_URL not set — skipping DB integration test")
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
	return &EventListener{
		cfg: &config.Config{
			SorobanRPCURL:     "http://localhost:8001",
			PoolContractID:    "CAKEWH7SJCXGV2MH2WZYIX3QDPTSSBQFXYVYBOWAGLNBBZMPLE2US6CS",
			JWTSecret:         "test-listener-secret",
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

	err := l.handleInvoiceCreated(ctx, event, time.Now().Unix())
	if err != nil {
		t.Fatalf("handleInvoiceCreated: %v", err)
	}
	t.Cleanup(func() {
		if db.Pool != nil {
			db.Pool.Exec(ctx, "DELETE FROM invoices WHERE id = $1", invoiceIDHex)
		}
	})

	got, err := db.GetInvoiceByID(ctx, invoiceIDHex)
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
	if err := db.InsertInvoice(ctx, inv); err != nil {
		t.Fatalf("setup InsertInvoice: %v", err)
	}
	t.Cleanup(func() {
		if db.Pool != nil {
			db.Pool.Exec(ctx, "DELETE FROM invoices WHERE id = $1", invoiceIDHex)
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

	if err := l.handleInvoiceListed(ctx, event); err != nil {
		t.Fatalf("handleInvoiceListed: %v", err)
	}

	got, err := db.GetInvoiceByID(ctx, invoiceIDHex)
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
	if err := db.InsertInvoice(ctx, inv); err != nil {
		t.Fatalf("setup InsertInvoice: %v", err)
	}
	t.Cleanup(func() {
		if db.Pool != nil {
			db.Pool.Exec(ctx, "DELETE FROM invoices WHERE id = $1", invoiceIDHex)
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

	if err := l.handleInvoiceShipped(ctx, event, time.Now().Unix()); err != nil {
		t.Fatalf("handleInvoiceShipped: %v", err)
	}

	got, err := db.GetInvoiceByID(ctx, invoiceIDHex)
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
	if err := db.InsertInvoice(ctx, inv); err != nil {
		t.Fatalf("setup InsertInvoice: %v", err)
	}
	t.Cleanup(func() {
		if db.Pool != nil {
			db.Pool.Exec(ctx, "DELETE FROM invoices WHERE id = $1", invoiceIDHex)
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

	if err := l.handleDeliveryConfirmed(ctx, event); err != nil {
		t.Fatalf("handleDeliveryConfirmed: %v", err)
	}

	got, err := db.GetInvoiceByID(ctx, invoiceIDHex)
	if err != nil || got == nil {
		t.Fatalf("GetInvoiceByID after confirmed: err=%v, got=%v", err, got)
	}
	if got.Status != "Confirmed" {
		t.Errorf("Status after confirmed: got %q, want %q", got.Status, "Confirmed")
	}
}
