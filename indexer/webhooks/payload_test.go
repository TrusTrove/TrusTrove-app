package webhooks

import (
	"encoding/json"
	"testing"
	"time"
)

func TestWebhookEnvelope_MarshalUnmarshal(t *testing.T) {
	tests := []struct {
		name     string
		envelope *WebhookEnvelope
	}{
		{
			name: "invoice.created payload",
			envelope: &WebhookEnvelope{
				SchemaVersion: SchemaVersion,
				EventType:     EventInvoiceCreated,
				EventID:       "evt_test123",
				OccurredAt:    time.Unix(1735516800, 0),
				Ledger:        1234567,
				ContractID:    "CABGWVIZFF62FG67ZGFEP67NEEY4WYTMFURDMFTKKNRDAFPKPOJDTN4C",
				Data:          json.RawMessage(`{"invoice_id":"INV123","issuer":"GBBD...","buyer":"GAAZ...","face_value":"1000000000","due_date":1735689600,"status":"Created"}`),
			},
		},
		{
			name: "pool.deposit payload",
			envelope: &WebhookEnvelope{
				SchemaVersion: SchemaVersion,
				EventType:     EventPoolDeposit,
				EventID:       "evt_test456",
				OccurredAt:    time.Unix(1735516900, 0),
				Ledger:        1234568,
				ContractID:    "CABGWVIZFF62FG67ZGFEP67NEEY4WYTMFURDMFTKKNRDAFPKPOJDTN4C",
				Data:          json.RawMessage(`{"account":"GBBD...","amount":"5000000000","shares":"5000000000","new_balance":"10000000000"}`),
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Marshal
			data, err := json.Marshal(tt.envelope)
			if err != nil {
				t.Fatalf("Marshal failed: %v", err)
			}

			// Unmarshal
			var got WebhookEnvelope
			if err := json.Unmarshal(data, &got); err != nil {
				t.Fatalf("Unmarshal failed: %v", err)
			}

			// Verify fields
			if got.SchemaVersion != tt.envelope.SchemaVersion {
				t.Errorf("SchemaVersion: got %q, want %q", got.SchemaVersion, tt.envelope.SchemaVersion)
			}
			if got.EventType != tt.envelope.EventType {
				t.Errorf("EventType: got %q, want %q", got.EventType, tt.envelope.EventType)
			}
			if got.EventID != tt.envelope.EventID {
				t.Errorf("EventID: got %q, want %q", got.EventID, tt.envelope.EventID)
			}
			if !got.OccurredAt.Equal(tt.envelope.OccurredAt) {
				t.Errorf("OccurredAt: got %v, want %v", got.OccurredAt, tt.envelope.OccurredAt)
			}
			if got.Ledger != tt.envelope.Ledger {
				t.Errorf("Ledger: got %d, want %d", got.Ledger, tt.envelope.Ledger)
			}
			if got.ContractID != tt.envelope.ContractID {
				t.Errorf("ContractID: got %q, want %q", got.ContractID, tt.envelope.ContractID)
			}
			if string(got.Data) != string(tt.envelope.Data) {
				t.Errorf("Data: got %s, want %s", got.Data, tt.envelope.Data)
			}
		})
	}
}

func TestInvoiceEventData_MarshalUnmarshal(t *testing.T) {
	data := InvoiceEventData{
		InvoiceID:        "INV1234567890abcdef",
		Issuer:           "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
		Buyer:            "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
		FaceValue:        "1000000000",
		DiscountBps:      200,
		FundedAmount:     "980000000",
		DueDate:          1735689600,
		Status:           "Funded",
		CreatedAt:        1735516800,
		FundedAt:         int64Ptr(1735520400),
		ShippedAt:        int64Ptr(1735524000),
		BuyerConfirmedAt: int64Ptr(1735527600),
		RepaidAt:         int64Ptr(1735531200),
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		t.Fatalf("Marshal failed: %v", err)
	}

	var got InvoiceEventData
	if err := json.Unmarshal(jsonData, &got); err != nil {
		t.Fatalf("Unmarshal failed: %v", err)
	}

	if got.InvoiceID != data.InvoiceID {
		t.Errorf("InvoiceID mismatch")
	}
	if got.Issuer != data.Issuer {
		t.Errorf("Issuer mismatch")
	}
	if got.Buyer != data.Buyer {
		t.Errorf("Buyer mismatch")
	}
	if got.FaceValue != data.FaceValue {
		t.Errorf("FaceValue mismatch")
	}
	if got.DiscountBps != data.DiscountBps {
		t.Errorf("DiscountBps: got %d, want %d", got.DiscountBps, data.DiscountBps)
	}
	if got.FundedAmount != data.FundedAmount {
		t.Errorf("FundedAmount mismatch")
	}
	if got.DueDate != data.DueDate {
		t.Errorf("DueDate mismatch")
	}
	if got.Status != data.Status {
		t.Errorf("Status mismatch")
	}
	if got.CreatedAt != data.CreatedAt {
		t.Errorf("CreatedAt mismatch")
	}
	if (got.FundedAt == nil) != (data.FundedAt == nil) || (got.FundedAt != nil && *got.FundedAt != *data.FundedAt) {
		t.Errorf("FundedAt mismatch")
	}
	if (got.ShippedAt == nil) != (data.ShippedAt == nil) || (got.ShippedAt != nil && *got.ShippedAt != *data.ShippedAt) {
		t.Errorf("ShippedAt mismatch")
	}
	if (got.BuyerConfirmedAt == nil) != (data.BuyerConfirmedAt == nil) || (got.BuyerConfirmedAt != nil && *got.BuyerConfirmedAt != *data.BuyerConfirmedAt) {
		t.Errorf("BuyerConfirmedAt mismatch")
	}
	if (got.RepaidAt == nil) != (data.RepaidAt == nil) || (got.RepaidAt != nil && *got.RepaidAt != *data.RepaidAt) {
		t.Errorf("RepaidAt mismatch")
	}
}

func TestPoolEventData_MarshalUnmarshal(t *testing.T) {
	data := PoolEventData{
		Account:     "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
		Amount:      "5000000000",
		Shares:      "5000000000",
		NewBalance:  "10000000000",
		YieldAmount: "15000000",
		TotalShares: "10000000000",
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		t.Fatalf("Marshal failed: %v", err)
	}

	var got PoolEventData
	if err := json.Unmarshal(jsonData, &got); err != nil {
		t.Fatalf("Unmarshal failed: %v", err)
	}

	if got.Account != data.Account {
		t.Errorf("Account mismatch")
	}
	if got.Amount != data.Amount {
		t.Errorf("Amount mismatch")
	}
	if got.Shares != data.Shares {
		t.Errorf("Shares mismatch")
	}
	if got.NewBalance != data.NewBalance {
		t.Errorf("NewBalance mismatch")
	}
	if got.YieldAmount != data.YieldAmount {
		t.Errorf("YieldAmount mismatch")
	}
	if got.TotalShares != data.TotalShares {
		t.Errorf("TotalShares mismatch")
	}
}

func TestNewInvoiceCreatedPayload(t *testing.T) {
	data := InvoiceEventData{
		InvoiceID: "INV123",
		Issuer:    "GBBD...",
		Buyer:     "GAAZ...",
		FaceValue: "1000000000",
		DueDate:   1735689600,
		Status:    "Created",
		CreatedAt: 1735516800,
	}

	env, err := NewInvoiceCreatedPayload(
		"evt_abc123",
		"CABGWVIZFF62FG67ZGFEP67NEEY4WYTMFURDMFTKKNRDAFPKPOJDTN4C",
		1234567,
		time.Unix(1735516800, 0),
		data,
	)
	if err != nil {
		t.Fatalf("NewInvoiceCreatedPayload failed: %v", err)
	}

	if env.SchemaVersion != SchemaVersion {
		t.Errorf("SchemaVersion: got %q, want %q", env.SchemaVersion, SchemaVersion)
	}
	if env.EventType != EventInvoiceCreated {
		t.Errorf("EventType: got %q, want %q", env.EventType, EventInvoiceCreated)
	}
	if env.EventID != "evt_abc123" {
		t.Errorf("EventID mismatch")
	}
	if env.Ledger != 1234567 {
		t.Errorf("Ledger mismatch")
	}
	if env.ContractID != "CABGWVIZFF62FG67ZGFEP67NEEY4WYTMFURDMFTKKNRDAFPKPOJDTN4C" {
		t.Errorf("ContractID mismatch")
	}

	// Verify data payload
	var got InvoiceEventData
	if err := json.Unmarshal(env.Data, &got); err != nil {
		t.Fatalf("Unmarshal Data failed: %v", err)
	}
	if got.InvoiceID != data.InvoiceID {
		t.Errorf("Data.InvoiceID mismatch")
	}
}

func TestNewPoolDepositPayload(t *testing.T) {
	data := PoolEventData{
		Account:     "GBBD...",
		Amount:      "5000000000",
		Shares:      "5000000000",
		NewBalance:  "10000000000",
		TotalShares: "10000000000",
	}

	env, err := NewPoolDepositPayload(
		"evt_def456",
		"CABGWVIZFF62FG67ZGFEP67NEEY4WYTMFURDMFTKKNRDAFPKPOJDTN4C",
		1234568,
		time.Unix(1735516900, 0),
		data,
	)
	if err != nil {
		t.Fatalf("NewPoolDepositPayload failed: %v", err)
	}

	if env.EventType != EventPoolDeposit {
		t.Errorf("EventType: got %q, want %q", env.EventType, EventPoolDeposit)
	}

	var got PoolEventData
	if err := json.Unmarshal(env.Data, &got); err != nil {
		t.Fatalf("Unmarshal Data failed: %v", err)
	}
	if got.Account != data.Account {
		t.Errorf("Data.Account mismatch")
	}
}

func TestAllEventTypes(t *testing.T) {
	types := AllEventTypes()
	expectedCount := 10 // 7 invoice + 3 pool events
	if len(types) != expectedCount {
		t.Errorf("AllEventTypes: got %d, want %d", len(types), expectedCount)
	}

	// Verify no duplicates
	seen := make(map[EventType]bool)
	for _, et := range types {
		if seen[et] {
			t.Errorf("Duplicate event type: %s", et)
		}
		seen[et] = true
	}
}

func TestExamplePayloads(t *testing.T) {
	// Just verify they produce valid JSON
	invoiceExample := ExampleInvoiceCreatedPayload()
	var env1 WebhookEnvelope
	if err := json.Unmarshal([]byte(invoiceExample), &env1); err != nil {
		t.Errorf("ExampleInvoiceCreatedPayload invalid JSON: %v", err)
	}
	if env1.EventType != EventInvoiceCreated {
		t.Errorf("Example invoice event type mismatch")
	}

	poolExample := ExamplePoolDepositPayload()
	var env2 WebhookEnvelope
	if err := json.Unmarshal([]byte(poolExample), &env2); err != nil {
		t.Errorf("ExamplePoolDepositPayload invalid JSON: %v", err)
	}
	if env2.EventType != EventPoolDeposit {
		t.Errorf("Example pool event type mismatch")
	}
}

func int64Ptr(v int64) *int64 {
	return &v
}
