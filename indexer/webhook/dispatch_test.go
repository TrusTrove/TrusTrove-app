package webhook

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"testing"
	"time"

	"trusttrove/indexer/db"
	"trusttrove/indexer/webhooks"
)

func TestMain(m *testing.M) {
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL != "" {
		if err := db.InitDB(context.Background(), dbURL); err != nil {
			fmt.Fprintf(os.Stderr, "failed to init test DB: %v\n", err)
			os.Exit(1)
		}
	}
	os.Exit(m.Run())
}

func skipIfNoDB(t *testing.T) {
	t.Helper()
	if os.Getenv("TEST_DATABASE_URL") == "" {
		t.Skip("TEST_DATABASE_URL not set — skipping DB integration test")
	}
}

const (
	testLedger         = int32(4_123_456)
	testLedgerClosedAt = int64(1_730_000_000)
)

// ptrTo returns a pointer to v, matching the *int64 the listener passes for
// nullable invoice columns.
func ptrTo(v int64) *int64 { return &v }

// invoiceDispatchData mirrors exactly what listener.EventEventListener
// .dispatchWebhookEvent hands to Dispatch for an invoice event: the event's
// own diagnostic fields plus every column re-read from the persisted invoice
// row. Keeping the shape here is what makes these tests a regression guard for
// issue #930 — the payload used to be built from the event alone, which left
// status, face_value and the lifecycle timestamps empty.
func invoiceDispatchData(eventName string) map[string]interface{} {
	return map[string]interface{}{
		"event_id":         "0001-00000004-0001-0001-0000-abc",
		"contract_id":      "CAIHRLVQM7XNSW2S5CFUQ4IPR6W2AOHJH5Q6EHPNLGLDWSWU7WRCJDZD",
		"ledger":           testLedger,
		"ledger_closed_at": testLedgerClosedAt,

		"invoice_id":         "INV-930",
		"issuer":             "GAKE4RRWTPSBWQ3S6KAPNLBQFSDR46EHPNLGLDWSWU7WRCJDZD",
		"buyer":              "GBRDVOQJF3S6KAPNLBQFSDR46EHPNLGLDWSWU7WRCJDZD",
		"face_value":         "1500000000",
		"discount_bps":       250,
		"funded_amount":      "1496250000",
		"due_date":           int64(1_738_000_000),
		"status":             "funded",
		"created_at":         int64(1_729_000_000),
		"funded_at":          ptrTo(int64(1_729_500_000)),
		"shipped_at":         (*int64)(nil),
		"buyer_confirmed_at": (*int64)(nil),
		"repaid_at":          (*int64)(nil),
	}
}

// decodeEnvelope marshals then unmarshals the envelope so assertions run
// against the JSON a subscriber actually receives, not the Go struct.
func decodeEnvelope(t *testing.T, env *webhooks.WebhookEnvelope) (map[string]interface{}, map[string]interface{}) {
	t.Helper()
	raw, err := json.Marshal(env)
	if err != nil {
		t.Fatalf("marshal envelope: %v", err)
	}
	var top map[string]interface{}
	if err := json.Unmarshal(raw, &top); err != nil {
		t.Fatalf("unmarshal envelope: %v", err)
	}
	var data map[string]interface{}
	if err := json.Unmarshal(env.Data, &data); err != nil {
		t.Fatalf("unmarshal envelope data: %v", err)
	}
	return top, data
}

// TestDispatchBuildsPopulatedInvoiceEnvelope covers issue #930's acceptance
// criterion: a real handleEvent-shaped map becomes an envelope whose
// contract_id, status and face_value are non-empty.
func TestDispatchBuildsPopulatedInvoiceEnvelope(t *testing.T) {
	env, err := BuildEnvelope("fund_invoice", invoiceDispatchData("fund_invoice"))
	if err != nil {
		t.Fatalf("BuildEnvelope: %v", err)
	}
	if env == nil {
		t.Fatal("BuildEnvelope returned nil envelope")
	}

	top, data := decodeEnvelope(t, env)

	for _, tc := range []struct {
		field string
		want  string
	}{
		{"schema_version", webhooks.SchemaVersion},
		{"event_type", string(webhooks.EventInvoiceFunded)},
		{"event_id", "0001-00000004-0001-0001-0000-abc"},
		{"contract_id", "CAIHRLVQM7XNSW2S5CFUQ4IPR6W2AOHJH5Q6EHPNLGLDWSWU7WRCJDZD"},
	} {
		if got, _ := top[tc.field].(string); got != tc.want {
			t.Errorf("envelope.%s: got %q, want %q", tc.field, got, tc.want)
		}
	}

	if got, ok := top["ledger"].(float64); !ok || got != float64(testLedger) {
		t.Errorf("envelope.ledger: got %#v, want %d", top["ledger"], testLedger)
	}

	// Every field docs/webhooks.md lists for invoice events must be populated.
	for _, tc := range []struct{ field, want string }{
		{"invoice_id", "INV-930"},
		{"issuer", "GAKE4RRWTPSBWQ3S6KAPNLBQFSDR46EHPNLGLDWSWU7WRCJDZD"},
		{"buyer", "GBRDVOQJF3S6KAPNLBQFSDR46EHPNLGLDWSWU7WRCJDZD"},
		{"face_value", "1500000000"},
		{"funded_amount", "1496250000"},
		{"status", "funded"},
	} {
		if got, _ := data[tc.field].(string); got == "" {
			t.Errorf("data.%s is empty in the marshalled payload", tc.field)
		} else if got != tc.want {
			t.Errorf("data.%s: got %q, want %q", tc.field, got, tc.want)
		}
	}

	for _, tc := range []struct {
		field string
		want  float64
	}{
		{"due_date", float64(int64(1_738_000_000))},
		{"created_at", float64(int64(1_729_000_000))},
		{"funded_at", float64(int64(1_729_500_000))},
	} {
		got, ok := data[tc.field].(float64)
		if !ok {
			t.Errorf("data.%s: got %#v, want the number %v", tc.field, data[tc.field], tc.want)
			continue
		}
		if got != tc.want {
			t.Errorf("data.%s: got %v, want %v", tc.field, got, tc.want)
		}
	}

	if got := data["discount_bps"]; fmt.Sprint(got) != "250" {
		t.Errorf("data.discount_bps: got %v, want 250", got)
	}
}

// TestBuildEnvelopeOccurredAtIsLedgerCloseTime pins #930's rule that
// occurred_at comes from the ledger close time, never from the wall clock. A
// re-indexed historical event must be reported with its original timestamp.
func TestBuildEnvelopeOccurredAtIsLedgerCloseTime(t *testing.T) {
	data := invoiceDispatchData("fund_invoice")
	env, err := BuildEnvelope("fund_invoice", data)
	if err != nil {
		t.Fatalf("BuildEnvelope: %v", err)
	}
	if got := env.OccurredAt.Unix(); got != testLedgerClosedAt {
		t.Errorf("occurred_at: got unix %d, want ledger_closed_at %d", got, testLedgerClosedAt)
	}
	if time.Since(env.OccurredAt) < 24*time.Hour {
		t.Errorf("occurred_at %v is within the last day; it looks like wall-clock time", env.OccurredAt)
	}

	// Without a close time the envelope still needs a usable timestamp.
	delete(data, "ledger_closed_at")
	env, err = BuildEnvelope("fund_invoice", data)
	if err != nil {
		t.Fatalf("BuildEnvelope without ledger_closed_at: %v", err)
	}
	if env.OccurredAt.IsZero() {
		t.Error("occurred_at is zero when no ledger close time was supplied")
	}
}

// TestBuildEnvelopeOmitsUnsetTimestamps keeps the omitempty contract intact:
// a nullable invoice column that is still NULL must be absent, not zero.
func TestBuildEnvelopeOmitsUnsetTimestamps(t *testing.T) {
	env, err := BuildEnvelope("mark_shipped", invoiceDispatchData("mark_shipped"))
	if err != nil {
		t.Fatalf("BuildEnvelope: %v", err)
	}
	_, data := decodeEnvelope(t, env)
	for _, field := range []string{"shipped_at", "buyer_confirmed_at", "repaid_at"} {
		if _, ok := data[field]; ok {
			t.Errorf("data.%s present with %v; NULL columns must be omitted, got %#v", field, data[field], data[field])
		}
	}
	if _, ok := data["funded_at"]; !ok {
		t.Error("data.funded_at missing although the invoice row has a funded_at")
	}
}

// TestBuildEnvelopeCoversInvoiceLifecycleEvents guards the switch in
// BuildEnvelope: every internal invoice name must reach its public type.
func TestBuildEnvelopeCoversInvoiceLifecycleEvents(t *testing.T) {
	cases := []struct {
		internal string
		public   webhooks.EventType
	}{
		{"create", webhooks.EventInvoiceCreated},
		{"list_for_financing", webhooks.EventInvoiceListed},
		{"fund_invoice", webhooks.EventInvoiceFunded},
		{"mark_shipped", webhooks.EventInvoiceShipped},
		{"confirm_delivery", webhooks.EventInvoiceConfirmed},
		{"repay", webhooks.EventInvoiceRepaid},
		{"trigger_default", webhooks.EventInvoiceDefaulted},
	}
	for _, tc := range cases {
		env, err := BuildEnvelope(tc.internal, invoiceDispatchData(tc.internal))
		if err != nil {
			t.Fatalf("BuildEnvelope(%q): %v", tc.internal, err)
		}
		if env.EventType != tc.public {
			t.Errorf("BuildEnvelope(%q).EventType: got %q, want %q", tc.internal, env.EventType, tc.public)
		}
		_, data := decodeEnvelope(t, env)
		if got, _ := data["status"].(string); got == "" {
			t.Errorf("BuildEnvelope(%q): data.status is empty", tc.internal)
		}
		if env.ContractID == "" {
			t.Errorf("BuildEnvelope(%q): contract_id is empty", tc.internal)
		}
	}
}

// TestBuildEnvelopePoolEvent checks the second documented payload shape so the
// invoice refactor cannot silently break pool dispatch.
func TestBuildEnvelopePoolEvent(t *testing.T) {
	data := map[string]interface{}{
		"event_id":         "0001-00000009-0002-0001-0000-pool",
		"contract_id":      "CAPOOLEVTCONTRACTID6W2AOHJH5Q6EHPNLGLDWSWU7WRCJDZD",
		"ledger":           testLedger,
		"ledger_closed_at": testLedgerClosedAt,
		"account":          "GDEPOSITORSYNTHETICALKAPNLBQFSDR46EHPNLGLDWSWU7AAA",
		"amount":           "5000000000",
		"shares":           "4950000000",
		"new_balance":      "12000000000",
	}
	env, err := BuildEnvelope("deposit", data)
	if err != nil {
		t.Fatalf("BuildEnvelope: %v", err)
	}
	if env.EventType != webhooks.EventPoolDeposit {
		t.Errorf("EventType: got %q, want %q", env.EventType, webhooks.EventPoolDeposit)
	}
	_, got := decodeEnvelope(t, env)
	for _, tc := range []struct{ field, want string }{
		{"account", "GDEPOSITORSYNTHETICALKAPNLBQFSDR46EHPNLGLDWSWU7AAA"},
		{"amount", "5000000000"},
		{"shares", "4950000000"},
		{"new_balance", "12000000000"},
	} {
		if v, _ := got[tc.field].(string); v != tc.want {
			t.Errorf("data.%s: got %q, want %q", tc.field, v, tc.want)
		}
	}
}

// TestBuildEnvelopeGenericFallback: an unmapped event name still produces a
// valid envelope carrying contract_id and the raw data, rather than an error
// that would drop the delivery.
func TestBuildEnvelopeGenericFallback(t *testing.T) {
	data := map[string]interface{}{
		"event_id":         "0001-00000010-0003-0001-0000-zzz",
		"contract_id":      "CAUNKNOWNXCONTRACT6W2AOHJH5Q6EHPNLGLDWSWU7WRCJDZD",
		"ledger":           testLedger,
		"ledger_closed_at": testLedgerClosedAt,
		"someting":         "value",
	}
	env, err := BuildEnvelope("some_future_event", data)
	if err != nil {
		t.Fatalf("BuildEnvelope: %v", err)
	}
	if env.EventType != webhooks.EventType("some_future_event") {
		t.Errorf("EventType: got %q, want the unmapped name preserved", env.EventType)
	}
	if env.ContractID == "" {
		t.Error("contract_id empty on the generic fallback path")
	}
	_, got := decodeEnvelope(t, env)
	if v, _ := got["someting"].(string); v != "value" {
		t.Errorf("generic data not preserved: %#v", got["someting"])
	}
	if v, _ := got["face_value"].(string); v != "" {
		t.Errorf("generic data must not gain invoice fields, got face_value=%q", v)
	}
}

// TestBuildEnvelopeEventIDFallback: without an event_id (an older caller or a
// synthetic dispatch) the envelope still carries a unique, non-empty id, which
// is what subscribers use to de-duplicate at-least-once deliveries.
func TestBuildEnvelopeEventIDFallback(t *testing.T) {
	data := invoiceDispatchData("fund_invoice")
	delete(data, "event_id")
	first, err := BuildEnvelope("fund_invoice", data)
	if err != nil {
		t.Fatalf("BuildEnvelope: %v", err)
	}
	if first.EventID == "" {
		t.Fatal("event_id empty when data has no event_id")
	}
	second, err := BuildEnvelope("fund_invoice", data)
	if err != nil {
		t.Fatalf("BuildEnvelope: %v", err)
	}
	if first.EventID == second.EventID {
		t.Errorf("synthesized event_id reused: %q", first.EventID)
	}
}

// TestDispatchQueuesPopulatedEnvelope is the end-to-end form of #930's
// criterion: Dispatch writes a delivery row whose payload is the full
// envelope, and the claiming read path returns it.
//
// The subscription is registered with the internal contract event name
// ("fund_invoice") because that is the string Dispatch uses for the lookup —
// see the internal-vs-public note in the PR description.
func TestDispatchQueuesPopulatedEnvelope(t *testing.T) {
	skipIfNoDB(t)
	ctx := context.Background()

	sub := &db.WebhookSubscription{
		TargetURL:     "https://example.invalid/webhook-930",
		EventTypes:    []string{"fund_invoice"},
		SigningSecret: "synthetic-secret-930",
		Active:        true,
	}
	if err := db.CreateWebhookSubscription(ctx, sub); err != nil {
		t.Fatalf("CreateWebhookSubscription: %v", err)
	}
	t.Cleanup(func() {
		if db.Pool != nil {
			db.Pool.Exec(ctx, "DELETE FROM webhook_deliveries WHERE subscription_id = $1", sub.ID)
			db.Pool.Exec(ctx, "DELETE FROM webhook_subscriptions WHERE id = $1", sub.ID)
		}
	})

	// Unique event id per run so the claim below cannot pick up a row left
	// behind by another test.
	eventID := fmt.Sprintf("dispatch-930-%d", time.Now().UnixNano())
	data := invoiceDispatchData("fund_invoice")
	data["event_id"] = eventID

	NewDispatcher().Dispatch(ctx, "fund_invoice", data)

	// Read this test's row directly rather than claiming: a claim takes any
	// pending rows, including rows another package's tests are claiming in the
	// same database at the same time.
	var payload []byte
	if err := db.Pool.QueryRow(ctx,
		"SELECT payload FROM webhook_deliveries WHERE event_id = $1 AND subscription_id = $2", eventID, sub.ID,
	).Scan(&payload); err != nil {
		t.Fatalf("Dispatch wrote no delivery row for event %s: %v", eventID, err)
	}

	var env webhooks.WebhookEnvelope
	if err := json.Unmarshal(payload, &env); err != nil {
		t.Fatalf("queued payload is not a valid envelope: %v", err)
	}
	if env.EventType != webhooks.EventInvoiceFunded {
		t.Errorf("queued EventType: got %q, want %q", env.EventType, webhooks.EventInvoiceFunded)
	}
	if env.ContractID == "" {
		t.Error("queued envelope has empty contract_id")
	}
	var invoice webhooks.InvoiceEventData
	if err := json.Unmarshal(env.Data, &invoice); err != nil {
		t.Fatalf("unmarshal invoice data: %v", err)
	}
	if invoice.Status == "" || invoice.FaceValue == "" {
		t.Errorf("queued envelope has empty invoice fields: status=%q face_value=%q", invoice.Status, invoice.FaceValue)
	}
	if env.OccurredAt.Unix() != testLedgerClosedAt {
		t.Errorf("occurred_at unix: got %d, want %d", env.OccurredAt.Unix(), testLedgerClosedAt)
	}
}

// TestDispatchWithoutSubscriptionsQueuesNothing keeps Dispatch's early return
// honest: no rows (and no wasted envelope builds) for untracked events.
func TestDispatchWithoutSubscriptionsQueuesNothing(t *testing.T) {
	skipIfNoDB(t)
	ctx := context.Background()

	eventID := fmt.Sprintf("dispatch-none-%d", time.Now().UnixNano())
	data := invoiceDispatchData("fund_invoice")
	data["event_id"] = eventID

	NewDispatcher().Dispatch(ctx, "fund_invoice", data)

	claimed, err := db.GetPendingDeliveries(ctx, 200)
	if err != nil {
		t.Fatalf("GetPendingDeliveries: %v", err)
	}
	for _, d := range claimed {
		if d.EventID == eventID {
			t.Fatalf("delivery %d queued for untracked event %s", d.ID, eventID)
		}
	}
}
