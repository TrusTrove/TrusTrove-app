// Package soroban holds the indexer's Soroban infrastructure: the low-level
// ScVal/XDR builders used to shape contract arguments, and the JSON-RPC client
// used to simulate and submit transactions. It deliberately knows nothing about
// HTTP transport or the indexer's domain types.
package soroban

import (
	"errors"
	"fmt"
	"math/big"

	"github.com/stellar/go-stellar-sdk/strkey"
	"github.com/stellar/go-stellar-sdk/txnbuild"
	"github.com/stellar/go-stellar-sdk/xdr"
)

// ParseAddressToScAddress converts a strkey-encoded account (G...) or contract
// (C...) address into its xdr.ScAddress representation.
func ParseAddressToScAddress(addr string) (xdr.ScAddress, error) {
	if len(addr) == 56 && addr[0] == 'G' {
		rawBytes, err := strkey.Decode(strkey.VersionByteAccountID, addr)
		if err != nil {
			return xdr.ScAddress{}, err
		}
		var uint256 xdr.Uint256
		copy(uint256[:], rawBytes)

		accountId := xdr.AccountId{
			Type:    xdr.PublicKeyTypePublicKeyTypeEd25519,
			Ed25519: &uint256,
		}
		return xdr.ScAddress{
			Type:      xdr.ScAddressTypeScAddressTypeAccount,
			AccountId: &accountId,
		}, nil
	} else if len(addr) == 56 && addr[0] == 'C' {
		rawBytes, err := strkey.Decode(strkey.VersionByteContract, addr)
		if err != nil {
			return xdr.ScAddress{}, err
		}
		var contractId xdr.ContractId
		copy(contractId[:], rawBytes)
		return xdr.ScAddress{
			Type:       xdr.ScAddressTypeScAddressTypeContract,
			ContractId: &contractId,
		}, nil
	}
	return xdr.ScAddress{}, fmt.Errorf("invalid address format: %s", addr)
}

// MakeAddressScVal wraps a strkey-encoded address as an address-typed ScVal.
func MakeAddressScVal(addr string) (xdr.ScVal, error) {
	scAddress, err := ParseAddressToScAddress(addr)
	if err != nil {
		return xdr.ScVal{}, err
	}
	return xdr.ScVal{
		Type:    xdr.ScValTypeScvAddress,
		Address: &scAddress,
	}, nil
}

// MakeU128ScVal splits val into the hi/lo 64-bit halves of a Soroban u128.
func MakeU128ScVal(val *big.Int) xdr.ScVal {
	hi := new(big.Int).Rsh(val, 64).Uint64()
	lo := new(big.Int).And(val, new(big.Int).SetUint64(0xffffffffffffffff)).Uint64()
	parts := xdr.UInt128Parts{
		Hi: xdr.Uint64(hi),
		Lo: xdr.Uint64(lo),
	}
	return xdr.ScVal{
		Type: xdr.ScValTypeScvU128,
		U128: &parts,
	}
}

// MakeU64ScVal wraps val as a u64-typed ScVal.
func MakeU64ScVal(val uint64) xdr.ScVal {
	u64Val := xdr.Uint64(val)
	return xdr.ScVal{
		Type: xdr.ScValTypeScvU64,
		U64:  &u64Val,
	}
}

// BuildInvokeContractOp builds an InvokeHostFunction operation that calls
// method on contractID with args.
func BuildInvokeContractOp(contractID string, method string, args []xdr.ScVal) (*txnbuild.InvokeHostFunction, error) {
	contractAddress, err := ParseAddressToScAddress(contractID)
	if err != nil {
		return nil, err
	}

	symbolFunc := xdr.ScSymbol(method)
	hostFn := xdr.HostFunction{
		Type: xdr.HostFunctionTypeHostFunctionTypeInvokeContract,
		InvokeContract: &xdr.InvokeContractArgs{
			ContractAddress: contractAddress,
			FunctionName:    symbolFunc,
			Args:            args,
		},
	}

	return &txnbuild.InvokeHostFunction{
		HostFunction: hostFn,
	}, nil
}

// ParseInvoiceIDFromResult decodes a base64 ScVal and returns its bytes payload
// as a hex string, which is how the invoice contract returns new invoice IDs.
func ParseInvoiceIDFromResult(resultXDR string) (string, error) {
	var val xdr.ScVal
	err := xdr.SafeUnmarshalBase64(resultXDR, &val)
	if err != nil {
		return "", err
	}
	if val.Bytes == nil {
		return "", errors.New("result is not bytes")
	}
	return fmt.Sprintf("%x", *val.Bytes), nil
}
