import {
  Address,
  nativeToScVal,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { BaseContractClient } from "../base.js";

export class EscrowClient extends BaseContractClient {
  async initialize(
    adminAddress: string,
    signerPublicKey: string,
  ): Promise<string> {
    const args = [new Address(adminAddress).toScVal()];
    return this.writeContract("initialize", args, signerPublicKey);
  }

  async lock(
    invoiceIdHex: string,
    amount: bigint,
    signerPublicKey: string,
  ): Promise<boolean> {
    const args = [
      xdr.ScVal.scvBytes(Buffer.from(invoiceIdHex, "hex")),
      nativeToScVal(amount, { type: "u128" }),
    ];
    return this.writeContract("lock", args, signerPublicKey).then(() => true);
  }

  async releaseToIssuer(
    invoiceIdHex: string,
    signerPublicKey: string,
  ): Promise<boolean> {
    const args = [xdr.ScVal.scvBytes(Buffer.from(invoiceIdHex, "hex"))];
    return this.writeContract("release_to_issuer", args, signerPublicKey).then(
      () => true,
    );
  }

  async releaseToPool(
    invoiceIdHex: string,
    repaymentAmount: bigint,
    signerPublicKey: string,
  ): Promise<boolean> {
    const args = [
      xdr.ScVal.scvBytes(Buffer.from(invoiceIdHex, "hex")),
      nativeToScVal(repaymentAmount, { type: "u128" }),
    ];
    return this.writeContract("release_to_pool", args, signerPublicKey).then(
      () => true,
    );
  }

  async handleDefault(
    invoiceIdHex: string,
    signerPublicKey: string,
  ): Promise<boolean> {
    const args = [xdr.ScVal.scvBytes(Buffer.from(invoiceIdHex, "hex"))];
    return this.writeContract("handle_default", args, signerPublicKey).then(
      () => true,
    );
  }

  async getLocked(
    invoiceIdHex: string,
    signerPublicKey: string,
  ): Promise<bigint> {
    const args = [xdr.ScVal.scvBytes(Buffer.from(invoiceIdHex, "hex"))];
    return this.readContract("get_locked", args, signerPublicKey, (val) =>
      typeof scValToNative(val) === "bigint"
        ? (scValToNative(val) as bigint)
        : BigInt(String(scValToNative(val) || 0)),
    );
  }
}
