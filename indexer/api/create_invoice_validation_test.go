package api

import (
	"context"
	"errors"
	"math/big"
	"net/http"
	"testing"

	"github.com/stellar/go-stellar-sdk/keypair"
)

// TestValidateCreateInvoiceRequest exercises the extracted request-validation
// step of HandleCreateInvoice directly, with no Soroban RPC or signing
// pipeline in play (Issue #674).
func TestValidateCreateInvoiceRequest(t *testing.T) {
	issuer, err := keypair.Random()
	if err != nil {
		t.Fatalf("generate issuer keypair: %v", err)
	}
	buyer, err := keypair.Random()
	if err != nil {
		t.Fatalf("generate buyer keypair: %v", err)
	}

	validBody := createInvoiceRequest{
		Buyer:     buyer.Address(),
		FaceValue: "1000",
		DueDate:   1700000000,
	}

	tests := []struct {
		name       string
		issuer     string
		withIssuer bool
		body       createInvoiceRequest
		wantStatus int
		wantMsg    string
	}{
		{
			name:       "missing authentication context",
			body:       validBody,
			wantStatus: http.StatusUnauthorized,
			wantMsg:    "Unauthorized: user address missing from context",
		},
		{
			name:       "empty issuer in context",
			issuer:     "",
			withIssuer: true,
			body:       validBody,
			wantStatus: http.StatusUnauthorized,
			wantMsg:    "Unauthorized: user address missing from context",
		},
		{
			name:       "missing buyer",
			issuer:     issuer.Address(),
			withIssuer: true,
			body:       createInvoiceRequest{Buyer: "", FaceValue: "1000", DueDate: 1700000000},
			wantStatus: http.StatusBadRequest,
			wantMsg:    "missing required invoice parameters",
		},
		{
			name:       "missing face value",
			issuer:     issuer.Address(),
			withIssuer: true,
			body:       createInvoiceRequest{Buyer: buyer.Address(), FaceValue: "", DueDate: 1700000000},
			wantStatus: http.StatusBadRequest,
			wantMsg:    "missing required invoice parameters",
		},
		{
			name:       "non-positive due date",
			issuer:     issuer.Address(),
			withIssuer: true,
			body:       createInvoiceRequest{Buyer: buyer.Address(), FaceValue: "1000", DueDate: 0},
			wantStatus: http.StatusBadRequest,
			wantMsg:    "missing required invoice parameters",
		},
		{
			name:       "invalid buyer address",
			issuer:     issuer.Address(),
			withIssuer: true,
			body:       createInvoiceRequest{Buyer: "not-a-stellar-address", FaceValue: "1000", DueDate: 1700000000},
			wantStatus: http.StatusBadRequest,
			wantMsg:    "invalid buyer address",
		},
		{
			name:       "zero face value",
			issuer:     issuer.Address(),
			withIssuer: true,
			body:       createInvoiceRequest{Buyer: buyer.Address(), FaceValue: "0", DueDate: 1700000000},
			wantStatus: http.StatusBadRequest,
			wantMsg:    "invalid face value",
		},
		{
			name:       "negative face value",
			issuer:     issuer.Address(),
			withIssuer: true,
			body:       createInvoiceRequest{Buyer: buyer.Address(), FaceValue: "-5", DueDate: 1700000000},
			wantStatus: http.StatusBadRequest,
			wantMsg:    "invalid face value",
		},
		{
			name:       "non-numeric face value",
			issuer:     issuer.Address(),
			withIssuer: true,
			body:       createInvoiceRequest{Buyer: buyer.Address(), FaceValue: "abc", DueDate: 1700000000},
			wantStatus: http.StatusBadRequest,
			wantMsg:    "invalid face value",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			if tt.withIssuer {
				ctx = WithUserAddress(ctx, tt.issuer)
			}

			params, err := validateCreateInvoiceRequest(ctx, tt.body)
			if err == nil {
				t.Fatalf("expected validation to fail, got params %+v", params)
			}
			if params != nil {
				t.Errorf("expected nil params on failure, got %+v", params)
			}

			var he *httpError
			if !errors.As(err, &he) {
				t.Fatalf("expected *httpError, got %T (%v)", err, err)
			}
			if he.Status() != tt.wantStatus {
				t.Errorf("status: got %d, want %d", he.Status(), tt.wantStatus)
			}
			if he.Error() != tt.wantMsg {
				t.Errorf("message: got %q, want %q", he.Error(), tt.wantMsg)
			}
		})
	}
}

func TestValidateCreateInvoiceRequest_ValidRequestReturnsParams(t *testing.T) {
	issuer, _ := keypair.Random()
	buyer, _ := keypair.Random()

	ctx := WithUserAddress(context.Background(), issuer.Address())
	// A face value beyond 2^64 confirms the value survives as a big.Int rather
	// than being truncated during validation.
	largeFaceValue := new(big.Int).Lsh(big.NewInt(1), 70)

	params, err := validateCreateInvoiceRequest(ctx, createInvoiceRequest{
		Buyer:     buyer.Address(),
		FaceValue: largeFaceValue.String(),
		DueDate:   1700000000,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if params.Issuer != issuer.Address() {
		t.Errorf("issuer: got %q, want %q", params.Issuer, issuer.Address())
	}
	if params.Buyer != buyer.Address() {
		t.Errorf("buyer: got %q, want %q", params.Buyer, buyer.Address())
	}
	if params.FaceValue.Cmp(largeFaceValue) != 0 {
		t.Errorf("face value: got %s, want %s", params.FaceValue, largeFaceValue)
	}
	if params.DueDate != 1700000000 {
		t.Errorf("due date: got %d, want %d", params.DueDate, 1700000000)
	}
}
