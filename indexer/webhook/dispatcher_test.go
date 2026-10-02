package webhook

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"testing"

	"trusttrove/indexer/webhooks"
)

// TestMapInternalEventType pins every documented internal→public event mapping
// and the default pass-through for unmapped names. BuildEnvelope relies on
// this function to pick the right payload constructor, so a silent mapping
// bug would ship the wrong schema to subscribers.
func TestMapInternalEventType(t *testing.T) {
	cases := []struct {
		internal string
		want     webhooks.EventType
	}{
		// invoice lifecycle
		{"create", webhooks.EventInvoiceCreated},
		{"InvoiceCreated", webhooks.EventInvoiceCreated},
		{"list_for_financing", webhooks.EventInvoiceListed},
		{"InvoiceListed", webhooks.EventInvoiceListed},
		{"fund_invoice", webhooks.EventInvoiceFunded},
		{"InvoiceFunded", webhooks.EventInvoiceFunded},
		{"mark_shipped", webhooks.EventInvoiceShipped},
		{"InvoiceShipped", webhooks.EventInvoiceShipped},
		{"confirm_delivery", webhooks.EventInvoiceConfirmed},
		{"DeliveryConfirmed", webhooks.EventInvoiceConfirmed},
		{"repay", webhooks.EventInvoiceRepaid},
		{"InvoiceRepaid", webhooks.EventInvoiceRepaid},
		{"trigger_default", webhooks.EventInvoiceDefaulted},
		{"InvoiceDefaulted", webhooks.EventInvoiceDefaulted},
		// pool events
		{"deposit", webhooks.EventPoolDeposit},
		{"PoolDeposit", webhooks.EventPoolDeposit},
		{"withdraw", webhooks.EventPoolWithdrawal},
		{"PoolWithdrawal", webhooks.EventPoolWithdrawal},
		{"yield_distribution", webhooks.EventPoolYieldDistributed},
		{"PoolYieldDistributed", webhooks.EventPoolYieldDistributed},
		// default: unmapped names pass through unchanged
		{"some_future_event", webhooks.EventType("some_future_event")},
		{"", webhooks.EventType("")},
	}

	for _, tc := range cases {
		got := mapInternalEventType(tc.internal)
		if got != tc.want {
			t.Errorf("mapInternalEventType(%q): got %q, want %q", tc.internal, got, tc.want)
		}
	}
}

// TestMapInternalEventTypeConstantsMatchDocs: the public string values are the
// subscriber-facing contract. A rename here breaks every external integration.
func TestMapInternalEventTypeConstantsMatchDocs(t *testing.T) {
	cases := []struct {
		internal string
		wantStr  string
	}{
		{"create", "invoice.created"},
		{"list_for_financing", "invoice.listed"},
		{"fund_invoice", "invoice.funded"},
		{"mark_shipped", "invoice.shipped"},
		{"confirm_delivery", "invoice.confirmed"},
		{"repay", "invoice.repaid"},
		{"trigger_default", "invoice.defaulted"},
		{"deposit", "pool.deposit"},
		{"withdraw", "pool.withdrawal"},
		{"yield_distribution", "pool.yield_distributed"},
	}
	for _, tc := range cases {
		if got := string(mapInternalEventType(tc.internal)); got != tc.wantStr {
			t.Errorf("mapInternalEventType(%q) string: got %q, want %q", tc.internal, got, tc.wantStr)
		}
	}
}

// knownSignVector is a pre-computed HMAC-SHA256 over "<timestamp>.<payload>",
// generated with an independent implementation so the test is a real vector
// check rather than a re-implementation of sign().
type knownSignVector struct {
	name      string
	secret    string
	timestamp string
	payload   string
	want      string
}

var knownSignVectors = []knownSignVector{
	{
		name:      "short secret, short payload",
		secret:    "secret",
		timestamp: "1234567890",
		payload:   "hello",
		want:      "b5f7f5b9a2db0fcb7ebfa864f097afb06988c9c9a55b211f158f274a23c03d95",
	},
	{
		name:      "realistic webhook signing secret",
		secret:    "test-secret",
		timestamp: "1730000000",
		payload:   `{"event":"invoice.created"}`,
		want:      "4930436bbeda5f6dd72c88b848ccbc352dcd64105766399abe5df086050ef9ba",
	},
	{
		name:      "alternate secret",
		secret:    "other-secret",
		timestamp: "9999999999",
		payload:   `{"other":true}`,
		want:      "d788e541b6d04f5e61092eb4752951c57c0b5940b1827eabe663a0d6c7d57cfb",
	},
}

// TestSignKnownVectors verifies sign() against known HMAC-SHA256 test vectors.
// The digest must be hex(hmac_sha256(secret, timestamp + "." + payload)).
func TestSignKnownVectors(t *testing.T) {
	for _, v := range knownSignVectors {
		t.Run(v.name, func(t *testing.T) {
			got := sign(v.secret, v.timestamp, []byte(v.payload))
			if got != v.want {
				t.Errorf("sign(%q, %q, %q):\n got %q\nwant %q", v.secret, v.timestamp, v.payload, got, v.want)
			}
			if len(got) != 64 {
				t.Errorf("signature length: got %d, want 64 hex chars", len(got))
			}
		})
	}
}

// TestSignMatchesIndependentHMAC re-derives the digest with crypto/hmac
// directly (the same construction sign() uses) and compares. This catches any
// accidental change to the message framing (e.g. dropping the "." separator).
func TestSignMatchesIndependentHMAC(t *testing.T) {
	cases := []struct {
		secret    string
		timestamp string
		payload   []byte
	}{
		{"k", "1", []byte("p")},
		{"s3cr3t", "1730000000", []byte(`{"a":1}`)},
		{"", "0", []byte("")},
	}
	for _, tc := range cases {
		mac := hmac.New(sha256.New, []byte(tc.secret))
		mac.Write([]byte(tc.timestamp + "."))
		mac.Write(tc.payload)
		want := hex.EncodeToString(mac.Sum(nil))

		got := sign(tc.secret, tc.timestamp, tc.payload)
		if got != want {
			t.Errorf("sign(%q, %q, %q):\n got %q\nwant %q", tc.secret, tc.timestamp, tc.payload, got, want)
		}
	}
}

// TestSignProducesDifferentDigests: a subscriber verifying signatures would
// accept any digest that matches, so two different inputs must never collide
// in the common cases we care about (different secret, timestamp, or payload).
func TestSignProducesDifferentDigests(t *testing.T) {
	base := sign("secret", "1730000000", []byte(`{"event":"invoice.created"}`))

	others := []struct {
		name    string
		secret  string
		ts      string
		payload string
	}{
		{"different secret", "other", "1730000000", `{"event":"invoice.created"}`},
		{"different timestamp", "secret", "1730000001", `{"event":"invoice.created"}`},
		{"different payload", "secret", "1730000000", `{"event":"invoice.funded"}`},
	}
	for _, o := range others {
		got := sign(o.secret, o.ts, []byte(o.payload))
		if got == base {
			t.Errorf("%s: produced the same signature as the base inputs", o.name)
		}
	}
}

// TestSignHexFormat: the dispatcher prefixes the digest with "sha256=" when
// setting X-TrusTrove-Signature; sign() itself must return bare lowercase hex.
func TestSignHexFormat(t *testing.T) {
	got := sign("secret", "1234567890", []byte("hello"))
	for i, c := range got {
		isHex := (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f')
		if !isHex {
			t.Fatalf("sign() output contains non-hex character %q at index %d", c, i)
		}
	}
}

// TestBuildEnvelopeEventMappingInEnvelopes covers the event-mapping half of
// BuildEnvelope that dispatch_test.go does not: internal *contract* names
// (the "Invoice*" style) and pool event names must each produce an envelope
// carrying the matching public EventType. The existing lifecycle test only
// exercises the snake_case internal names for invoices.
func TestBuildEnvelopeEventMappingInEnvelopes(t *testing.T) {
	cases := []struct {
		internal string
		wantType webhooks.EventType
		poolData bool
	}{
		{"create", webhooks.EventInvoiceCreated, false},
		{"InvoiceCreated", webhooks.EventInvoiceCreated, false},
		{"list_for_financing", webhooks.EventInvoiceListed, false},
		{"InvoiceListed", webhooks.EventInvoiceListed, false},
		{"fund_invoice", webhooks.EventInvoiceFunded, false},
		{"InvoiceFunded", webhooks.EventInvoiceFunded, false},
		{"mark_shipped", webhooks.EventInvoiceShipped, false},
		{"InvoiceShipped", webhooks.EventInvoiceShipped, false},
		{"confirm_delivery", webhooks.EventInvoiceConfirmed, false},
		{"DeliveryConfirmed", webhooks.EventInvoiceConfirmed, false},
		{"repay", webhooks.EventInvoiceRepaid, false},
		{"InvoiceRepaid", webhooks.EventInvoiceRepaid, false},
		{"trigger_default", webhooks.EventInvoiceDefaulted, false},
		{"InvoiceDefaulted", webhooks.EventInvoiceDefaulted, false},
		{"deposit", webhooks.EventPoolDeposit, true},
		{"PoolDeposit", webhooks.EventPoolDeposit, true},
		{"withdraw", webhooks.EventPoolWithdrawal, true},
		{"PoolWithdrawal", webhooks.EventPoolWithdrawal, true},
		{"yield_distribution", webhooks.EventPoolYieldDistributed, true},
		{"PoolYieldDistributed", webhooks.EventPoolYieldDistributed, true},
	}

	for _, tc := range cases {
		data := map[string]interface{}{
			"event_id":    "evt-map-" + tc.internal,
			"contract_id": "CAMAPPEDCONTRACT6W2AOHJH5Q6EHPNLGLDWSWU7WRCJDZD",
		}
		if tc.poolData {
			data["account"] = "GPOOLACCOUNTSYNTHETICALKAPNLBQFSDR46EHPNLGLDWSWU7AAA"
			data["amount"] = "1000000000"
		} else {
			data["invoice_id"] = "INV-MAP"
			data["issuer"] = "GISSUERSYNTHETICALKAPNLBQFSDR46EHPNLGLDWSWU7AAA"
			data["buyer"] = "GBUYERSYNTHETICALKAPNLBQFSDR46EHPNLGLDWSWU7AAA"
			data["face_value"] = "1000000000"
			data["due_date"] = int64(1_738_000_000)
			data["status"] = "created"
			data["created_at"] = int64(1_729_000_000)
		}

		env, err := BuildEnvelope(tc.internal, data)
		if err != nil {
			t.Fatalf("BuildEnvelope(%q): %v", tc.internal, err)
		}
		if env == nil {
			t.Fatalf("BuildEnvelope(%q): nil envelope", tc.internal)
		}
		if env.EventType != tc.wantType {
			t.Errorf("BuildEnvelope(%q).EventType: got %q, want %q", tc.internal, env.EventType, tc.wantType)
		}
		if env.SchemaVersion != webhooks.SchemaVersion {
			t.Errorf("BuildEnvelope(%q).SchemaVersion: got %q, want %q", tc.internal, env.SchemaVersion, webhooks.SchemaVersion)
		}
		if env.ContractID == "" {
			t.Errorf("BuildEnvelope(%q): contract_id empty", tc.internal)
		}
		if env.EventID == "" {
			t.Errorf("BuildEnvelope(%q): event_id empty", tc.internal)
		}
		if len(env.Data) == 0 {
			t.Errorf("BuildEnvelope(%q): data payload empty", tc.internal)
		}
	}
}

// TestBuildEnvelopeUnmappedEventUsesPassThroughType: an unknown internal name
// must produce an envelope whose EventType is the name itself, not an error —
// dropping the delivery would lose events from future contract versions.
func TestBuildEnvelopeUnmappedEventUsesPassThroughType(t *testing.T) {
	data := map[string]interface{}{
		"event_id":    "evt-future-1",
		"contract_id": "CAUNKNOWNCONTRACT6W2AOHJH5Q6EHPNLGLDWSWU7WRCJDZD",
		"ledger":      int32(99),
	}
	env, err := BuildEnvelope("future_invoice_event", data)
	if err != nil {
		t.Fatalf("BuildEnvelope: %v", err)
	}
	if env.EventType != webhooks.EventType("future_invoice_event") {
		t.Errorf("EventType: got %q, want pass-through of internal name", env.EventType)
	}
	if env.Ledger != 99 {
		t.Errorf("ledger: got %d, want 99", env.Ledger)
	}
}
