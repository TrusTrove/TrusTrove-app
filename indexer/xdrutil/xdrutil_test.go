package xdrutil

import (
	"math"
	"testing"

	"github.com/stellar/go-stellar-sdk/strkey"
	"github.com/stellar/go-stellar-sdk/xdr"
)

// helpers to build ScVal instances for testing

func makeU128ScVal(hi, lo uint64) xdr.ScVal {
	parts := xdr.UInt128Parts{
		Hi: xdr.Uint64(hi),
		Lo: xdr.Uint64(lo),
	}
	return xdr.ScVal{Type: xdr.ScValTypeScvU128, U128: &parts}
}

func makeU32ScVal(v uint32) xdr.ScVal {
	u := xdr.Uint32(v)
	return xdr.ScVal{Type: xdr.ScValTypeScvU32, U32: &u}
}

func makeU64ScVal(v uint64) xdr.ScVal {
	u := xdr.Uint64(v)
	return xdr.ScVal{Type: xdr.ScValTypeScvU64, U64: &u}
}

func makeBytesScVal(b []byte) xdr.ScVal {
	bytes := xdr.ScBytes(b)
	return xdr.ScVal{Type: xdr.ScValTypeScvBytes, Bytes: &bytes}
}

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

func makeContractAddressScVal(address string) xdr.ScVal {
	raw, _ := strkey.Decode(strkey.VersionByteContract, address)
	var contractId xdr.ContractId
	copy(contractId[:], raw)
	scAddr := xdr.ScAddress{
		Type:       xdr.ScAddressTypeScAddressTypeContract,
		ContractId: &contractId,
	}
	return xdr.ScVal{Type: xdr.ScValTypeScvAddress, Address: &scAddr}
}

// makeMapScVal builds a map ScVal from key→value pairs.
// ScVal.Map is **xdr.ScMap (nullable XDR pointer), so we build via two pointer steps.
func makeMapScVal(entries []struct {
	key string
	val xdr.ScVal
}) xdr.ScVal {
	var scMap xdr.ScMap
	for _, e := range entries {
		sym := xdr.ScSymbol(e.key)
		scMap = append(scMap, xdr.ScMapEntry{
			Key: xdr.ScVal{Type: xdr.ScValTypeScvSymbol, Sym: &sym},
			Val: e.val,
		})
	}
	inner := &scMap
	return xdr.ScVal{Type: xdr.ScValTypeScvMap, Map: &inner}
}

// --- ParseAddress ---

func TestParseAddress_Account(t *testing.T) {
	const addr = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
	val := makeAccountAddressScVal(addr)
	got := ParseAddress(val)
	if got != addr {
		t.Errorf("ParseAddress account: got %q, want %q", got, addr)
	}
}

func TestParseAddress_Contract(t *testing.T) {
	const addr = "CAKEWH7SJCXGV2MH2WZYIX3QDPTSSBQFXYVYBOWAGLNBBZMPLE2US6CS"
	val := makeContractAddressScVal(addr)
	got := ParseAddress(val)
	if got != addr {
		t.Errorf("ParseAddress contract: got %q, want %q", got, addr)
	}
}

func TestParseAddress_WrongType(t *testing.T) {
	val := makeU32ScVal(42)
	if got := ParseAddress(val); got != "" {
		t.Errorf("ParseAddress wrong type: want empty string, got %q", got)
	}
}

// --- ParseBytes ---

func TestParseBytes_Normal(t *testing.T) {
	val := makeBytesScVal([]byte{0xde, 0xad, 0xbe, 0xef})
	got := ParseBytes(val)
	if got != "deadbeef" {
		t.Errorf("ParseBytes: got %q, want %q", got, "deadbeef")
	}
}

func TestParseBytes_Empty(t *testing.T) {
	val := makeBytesScVal([]byte{})
	if got := ParseBytes(val); got != "" {
		t.Errorf("ParseBytes empty: want empty string, got %q", got)
	}
}

func TestParseBytes_WrongType(t *testing.T) {
	val := makeU32ScVal(1)
	if got := ParseBytes(val); got != "" {
		t.Errorf("ParseBytes wrong type: want empty string, got %q", got)
	}
}

// --- ParseU128 ---

func TestParseU128_Zero(t *testing.T) {
	val := makeU128ScVal(0, 0)
	if got := ParseU128(val); got != "0" {
		t.Errorf("ParseU128 zero: got %q, want %q", got, "0")
	}
}

func TestParseU128_LoOnly(t *testing.T) {
	val := makeU128ScVal(0, 1000000)
	if got := ParseU128(val); got != "1000000" {
		t.Errorf("ParseU128 lo-only: got %q, want %q", got, "1000000")
	}
}

func TestParseU128_Combined(t *testing.T) {
	// hi=1, lo=0 => 2^64
	val := makeU128ScVal(1, 0)
	want := "18446744073709551616" // 2^64
	if got := ParseU128(val); got != want {
		t.Errorf("ParseU128 hi=1,lo=0: got %q, want %q", got, want)
	}
}

// TestParseU128_OverflowFix verifies the int64 overflow fix.
// Before the fix, Hi=MaxUint64 would be cast to int64(-1), producing a negative result.
func TestParseU128_OverflowFix(t *testing.T) {
	val := makeU128ScVal(math.MaxUint64, math.MaxUint64)
	want := "340282366920938463463374607431768211455" // 2^128 - 1
	if got := ParseU128(val); got != want {
		t.Errorf("ParseU128 overflow fix: got %q, want %q", got, want)
	}
}

func TestParseU128_WrongType(t *testing.T) {
	val := makeU32ScVal(5)
	if got := ParseU128(val); got != "0" {
		t.Errorf("ParseU128 wrong type: got %q, want %q", got, "0")
	}
}

// --- ParseU32 ---

func TestParseU32_Normal(t *testing.T) {
	val := makeU32ScVal(9500)
	if got := ParseU32(val); got != 9500 {
		t.Errorf("ParseU32: got %d, want %d", got, 9500)
	}
}

func TestParseU32_Zero(t *testing.T) {
	val := makeU32ScVal(0)
	if got := ParseU32(val); got != 0 {
		t.Errorf("ParseU32 zero: got %d, want 0", got)
	}
}

func TestParseU32_WrongType(t *testing.T) {
	val := makeU128ScVal(0, 42)
	if got := ParseU32(val); got != 0 {
		t.Errorf("ParseU32 wrong type: got %d, want 0", got)
	}
}

// --- ParseU64 ---

func TestParseU64_Normal(t *testing.T) {
	val := makeU64ScVal(1718000000)
	if got := ParseU64(val); got != 1718000000 {
		t.Errorf("ParseU64: got %d, want %d", got, 1718000000)
	}
}

func TestParseU64_Zero(t *testing.T) {
	val := makeU64ScVal(0)
	if got := ParseU64(val); got != 0 {
		t.Errorf("ParseU64 zero: got %d, want 0", got)
	}
}

func TestParseU64_WrongType(t *testing.T) {
	val := makeU32ScVal(5)
	if got := ParseU64(val); got != 0 {
		t.Errorf("ParseU64 wrong type: got %d, want 0", got)
	}
}

// --- GetMapVal ---

func TestGetMapVal_Found(t *testing.T) {
	wantVal := makeU32ScVal(777)
	mapVal := makeMapScVal([]struct {
		key string
		val xdr.ScVal
	}{
		{"amount", wantVal},
	})

	got, ok := GetMapVal(mapVal, "amount")
	if !ok {
		t.Fatal("GetMapVal: expected ok=true, got false")
	}
	if got.Type != xdr.ScValTypeScvU32 {
		t.Errorf("GetMapVal: got type %v, want ScvU32", got.Type)
	}
}

func TestGetMapVal_NotFound(t *testing.T) {
	mapVal := makeMapScVal([]struct {
		key string
		val xdr.ScVal
	}{
		{"x", makeU32ScVal(1)},
	})
	_, ok := GetMapVal(mapVal, "missing")
	if ok {
		t.Error("GetMapVal: expected ok=false for missing key")
	}
}

func TestGetMapVal_WrongType(t *testing.T) {
	val := makeU32ScVal(5)
	_, ok := GetMapVal(val, "key")
	if ok {
		t.Error("GetMapVal: expected ok=false for non-map ScVal")
	}
}

func TestGetMapVal_NilMap(t *testing.T) {
	val := xdr.ScVal{Type: xdr.ScValTypeScvMap, Map: nil}
	_, ok := GetMapVal(val, "key")
	if ok {
		t.Error("GetMapVal: expected ok=false for nil map pointer")
	}
}
