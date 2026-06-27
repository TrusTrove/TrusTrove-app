package xdrutil

import (
	"fmt"
	"math/big"

	"github.com/stellar/go-stellar-sdk/strkey"
	"github.com/stellar/go-stellar-sdk/xdr"
)

// ParseAddress decodes an xdr.ScVal address into a Stellar address string.
// Returns an empty string if the value is not an address type.
func ParseAddress(val xdr.ScVal) string {
	if val.Type != xdr.ScValTypeScvAddress || val.Address == nil {
		return ""
	}
	addr := val.Address
	switch addr.Type {
	case xdr.ScAddressTypeScAddressTypeAccount:
		if addr.AccountId != nil && addr.AccountId.Ed25519 != nil {
			address, _ := strkey.Encode(strkey.VersionByteAccountID, addr.AccountId.Ed25519[:])
			return address
		}
	case xdr.ScAddressTypeScAddressTypeContract:
		if addr.ContractId != nil {
			address, _ := strkey.Encode(strkey.VersionByteContract, addr.ContractId[:])
			return address
		}
	}
	return ""
}

// ParseBytes extracts and hex-encodes a byte array ScVal.
// Returns an empty string if the value is not a bytes type.
func ParseBytes(val xdr.ScVal) string {
	if val.Type != xdr.ScValTypeScvBytes || val.Bytes == nil {
		return ""
	}
	return fmt.Sprintf("%x", *val.Bytes)
}

// ParseU128 converts a U128 ScVal to its decimal string representation.
// Returns "0" if the value is not a U128 type or is nil.
// Uses SetUint64 to avoid int64 overflow for values with Hi >= 2^63.
func ParseU128(val xdr.ScVal) string {
	if val.Type != xdr.ScValTypeScvU128 || val.U128 == nil {
		return "0"
	}
	hi := new(big.Int).SetUint64(uint64(val.U128.Hi))
	lo := new(big.Int).SetUint64(uint64(val.U128.Lo))
	result := new(big.Int).Lsh(hi, 64)
	result.Or(result, lo)
	return result.String()
}

// ParseU32 extracts the value from a U32 ScVal.
// Returns 0 if the value is not a U32 type or is nil.
func ParseU32(val xdr.ScVal) uint32 {
	if val.Type != xdr.ScValTypeScvU32 || val.U32 == nil {
		return 0
	}
	return uint32(*val.U32)
}

// ParseU64 extracts the value from a U64 ScVal.
// Returns 0 if the value is not a U64 type or is nil.
func ParseU64(val xdr.ScVal) int64 {
	if val.Type != xdr.ScValTypeScvU64 || val.U64 == nil {
		return 0
	}
	return int64(*val.U64)
}

// GetMapVal finds and returns the ScVal for the given symbol key in a map ScVal.
// Returns (zero ScVal, false) if the map does not contain the key.
func GetMapVal(val xdr.ScVal, key string) (xdr.ScVal, bool) {
	if val.Type != xdr.ScValTypeScvMap || val.Map == nil || *val.Map == nil {
		return xdr.ScVal{}, false
	}
	for _, entry := range **val.Map {
		if entry.Key.Type == xdr.ScValTypeScvSymbol && entry.Key.Sym != nil {
			if string(*entry.Key.Sym) == key {
				return entry.Val, true
			}
		}
	}
	return xdr.ScVal{}, false
}
