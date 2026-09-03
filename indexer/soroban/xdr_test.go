package soroban

import (
	"math/big"
	"strings"
	"testing"

	"github.com/stellar/go-stellar-sdk/keypair"
	"github.com/stellar/go-stellar-sdk/xdr"
)

// ------------------------------------------------------------------
// ParseInvoiceIDFromResult
// ------------------------------------------------------------------

func TestParseInvoiceIDFromResult_HappyPathReturnsHex(t *testing.T) {
	invBytes := []byte("abc123")
	sb := xdr.ScBytes(invBytes)
	val := xdr.ScVal{Type: xdr.ScValTypeScvBytes, Bytes: &sb}
	got, err := ParseInvoiceIDFromResult(encodeScVal(t, val))
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	want := "616263313233" // hex of "abc123"
	if got != want {
		t.Errorf("expected hex %q, got %q", want, got)
	}
}

func TestParseInvoiceIDFromResult_InvalidBase64ReturnsError(t *testing.T) {
	if _, err := ParseInvoiceIDFromResult("not valid base64 $$$"); err == nil {
		t.Fatal("expected error for invalid base64 XDR")
	}
}

func TestParseInvoiceIDFromResult_NonBytesScValReturnsError(t *testing.T) {
	u64 := xdr.Uint64(42)
	val := xdr.ScVal{Type: xdr.ScValTypeScvU64, U64: &u64}
	_, err := ParseInvoiceIDFromResult(encodeScVal(t, val))
	if err == nil {
		t.Fatal("expected error when result is not a bytes ScVal")
	}
	if !strings.Contains(err.Error(), "not bytes") {
		t.Errorf("expected 'not bytes' in error, got %v", err)
	}
}

// ------------------------------------------------------------------
// ParseAddressToScAddress / MakeAddressScVal
// ------------------------------------------------------------------

func TestParseAddressToScAddress_AccountAndContract(t *testing.T) {
	accountKP, err := keypair.Random()
	if err != nil {
		t.Fatalf("generate keypair: %v", err)
	}

	got, err := ParseAddressToScAddress(accountKP.Address())
	if err != nil {
		t.Fatalf("account address: unexpected error %v", err)
	}
	if got.Type != xdr.ScAddressTypeScAddressTypeAccount || got.AccountId == nil {
		t.Errorf("expected account ScAddress, got %v", got.Type)
	}

	got, err = ParseAddressToScAddress(validContractID(t))
	if err != nil {
		t.Fatalf("contract address: unexpected error %v", err)
	}
	if got.Type != xdr.ScAddressTypeScAddressTypeContract || got.ContractId == nil {
		t.Errorf("expected contract ScAddress, got %v", got.Type)
	}
}

func TestParseAddressToScAddress_InvalidAddressReturnsError(t *testing.T) {
	for _, addr := range []string{"", "not-an-address", strings.Repeat("X", 56)} {
		if _, err := ParseAddressToScAddress(addr); err == nil {
			t.Errorf("expected error for address %q", addr)
		}
	}
}

func TestMakeAddressScVal_WrapsAddress(t *testing.T) {
	kp, _ := keypair.Random()
	val, err := MakeAddressScVal(kp.Address())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if val.Type != xdr.ScValTypeScvAddress || val.Address == nil {
		t.Fatalf("expected address ScVal, got %v", val.Type)
	}

	if _, err := MakeAddressScVal("nope"); err == nil {
		t.Error("expected error for invalid address")
	}
}

// ------------------------------------------------------------------
// MakeU128ScVal / MakeU64ScVal
// ------------------------------------------------------------------

func TestMakeU128ScVal_SplitsHiLoHalves(t *testing.T) {
	// 2^64 + 7 => Hi=1, Lo=7
	val := new(big.Int).Lsh(big.NewInt(1), 64)
	val.Add(val, big.NewInt(7))

	got := MakeU128ScVal(val)
	if got.Type != xdr.ScValTypeScvU128 || got.U128 == nil {
		t.Fatalf("expected u128 ScVal, got %v", got.Type)
	}
	if got.U128.Hi != 1 || got.U128.Lo != 7 {
		t.Errorf("expected Hi=1 Lo=7, got Hi=%d Lo=%d", got.U128.Hi, got.U128.Lo)
	}
}

func TestMakeU64ScVal_WrapsValue(t *testing.T) {
	got := MakeU64ScVal(1700000000)
	if got.Type != xdr.ScValTypeScvU64 || got.U64 == nil {
		t.Fatalf("expected u64 ScVal, got %v", got.Type)
	}
	if *got.U64 != xdr.Uint64(1700000000) {
		t.Errorf("expected 1700000000, got %d", *got.U64)
	}
}

// ------------------------------------------------------------------
// BuildInvokeContractOp
// ------------------------------------------------------------------

func TestBuildInvokeContractOp_SetsFunctionAndArgs(t *testing.T) {
	arg := MakeU64ScVal(42)
	op, err := BuildInvokeContractOp(validContractID(t), "create", []xdr.ScVal{arg})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	invoke := op.HostFunction.InvokeContract
	if invoke == nil {
		t.Fatal("expected InvokeContract host function")
	}
	if invoke.FunctionName != xdr.ScSymbol("create") {
		t.Errorf("expected function name 'create', got %q", invoke.FunctionName)
	}
	if len(invoke.Args) != 1 {
		t.Errorf("expected 1 arg, got %d", len(invoke.Args))
	}
}

func TestBuildInvokeContractOp_InvalidContractIDReturnsError(t *testing.T) {
	if _, err := BuildInvokeContractOp("not-a-contract", "create", nil); err == nil {
		t.Fatal("expected error for invalid contract id")
	}
}
