package db

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"
)

// skipIfNoDB skips the test when TEST_DATABASE_URL is not set.
// This allows go test ./... to pass in CI without a live database.
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
		if err := InitDB(ctx, dbURL); err != nil {
			fmt.Fprintf(os.Stderr, "failed to init test DB: %v\n", err)
			os.Exit(1)
		}
	}
	os.Exit(m.Run())
}

func TestInsertAndGetInvoice(t *testing.T) {
	skipIfNoDB(t)

	ctx := context.Background()
	id := fmt.Sprintf("testid%d", time.Now().UnixNano())
	inv := &DbInvoice{
		ID:          id,
		Issuer:      "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
		Buyer:       "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
		FaceValue:   "1000000000",
		DiscountBps: 0,
		FundedAmount: "0",
		DueDate:     time.Now().Add(30 * 24 * time.Hour).Unix(),
		Status:      "Created",
		CreatedAt:   time.Now().Unix(),
	}

	if err := InsertInvoice(ctx, inv); err != nil {
		t.Fatalf("InsertInvoice: %v", err)
	}
	t.Cleanup(func() {
		if Pool != nil {
			Pool.Exec(ctx, "DELETE FROM invoices WHERE id = $1", id)
		}
	})

	got, err := GetInvoiceByID(ctx, id)
	if err != nil {
		t.Fatalf("GetInvoiceByID: %v", err)
	}
	if got == nil {
		t.Fatal("GetInvoiceByID: returned nil, want invoice")
	}
	if got.ID != id {
		t.Errorf("GetInvoiceByID: got ID %q, want %q", got.ID, id)
	}
	if got.Issuer != inv.Issuer {
		t.Errorf("GetInvoiceByID: got Issuer %q, want %q", got.Issuer, inv.Issuer)
	}
	if got.FaceValue != inv.FaceValue {
		t.Errorf("GetInvoiceByID: got FaceValue %q, want %q", got.FaceValue, inv.FaceValue)
	}
}

func TestGetInvoiceByID_NotFound(t *testing.T) {
	skipIfNoDB(t)

	ctx := context.Background()
	got, err := GetInvoiceByID(ctx, "nonexistent-id-xyz")
	if err != nil {
		t.Fatalf("GetInvoiceByID not found: unexpected error: %v", err)
	}
	if got != nil {
		t.Errorf("GetInvoiceByID not found: want nil, got %+v", got)
	}
}

func TestGetInvoicesPage(t *testing.T) {
	skipIfNoDB(t)

	ctx := context.Background()
	id1 := fmt.Sprintf("page-test-a%d", time.Now().UnixNano())
	id2 := fmt.Sprintf("page-test-b%d", time.Now().UnixNano())

	issuer := "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
	for _, id := range []string{id1, id2} {
		inv := &DbInvoice{
			ID:           id,
			Issuer:       issuer,
			Buyer:        "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
			FaceValue:    "500000000",
			DiscountBps:  0,
			FundedAmount: "0",
			DueDate:      time.Now().Add(30 * 24 * time.Hour).Unix(),
			Status:       "Created",
			CreatedAt:    time.Now().Unix(),
		}
		if err := InsertInvoice(ctx, inv); err != nil {
			t.Fatalf("InsertInvoice %s: %v", id, err)
		}
	}
	t.Cleanup(func() {
		if Pool != nil {
			for _, id := range []string{id1, id2} {
				Pool.Exec(ctx, "DELETE FROM invoices WHERE id = $1", id)
			}
		}
	})

	// Fetch by issuer with limit 10
	invoices, total, err := GetInvoicesPage(ctx, "", issuer, 10, 0)
	if err != nil {
		t.Fatalf("GetInvoicesPage: %v", err)
	}
	if total < 2 {
		t.Errorf("GetInvoicesPage total: got %d, want >= 2", total)
	}
	if len(invoices) < 2 {
		t.Errorf("GetInvoicesPage len: got %d, want >= 2", len(invoices))
	}

	// Fetch with status filter that matches none of our test records
	invoices2, total2, err := GetInvoicesPage(ctx, "Repaid", issuer, 10, 0)
	if err != nil {
		t.Fatalf("GetInvoicesPage status filter: %v", err)
	}
	for _, inv := range invoices2 {
		if inv.Issuer != issuer {
			t.Errorf("status filter returned wrong issuer: %q", inv.Issuer)
		}
		if inv.Status != "Repaid" {
			t.Errorf("status filter returned wrong status: %q", inv.Status)
		}
	}
	_ = total2
}

func TestGetPoolStats_Empty(t *testing.T) {
	skipIfNoDB(t)

	ctx := context.Background()
	stats, err := GetPoolStats(ctx)
	if err != nil {
		t.Fatalf("GetPoolStats: %v", err)
	}
	// An empty pool_snapshots table returns nil (no error)
	_ = stats
}

func TestGetProtocolStats_Empty(t *testing.T) {
	skipIfNoDB(t)

	ctx := context.Background()
	stats, err := GetProtocolStats(ctx)
	if err != nil {
		t.Fatalf("GetProtocolStats: %v", err)
	}
	if stats == nil {
		t.Fatal("GetProtocolStats: returned nil, want stats struct")
	}
	// With a fresh test DB, totals should be zero
	if stats.TotalInvoices < 0 {
		t.Errorf("GetProtocolStats TotalInvoices: %d", stats.TotalInvoices)
	}
}
