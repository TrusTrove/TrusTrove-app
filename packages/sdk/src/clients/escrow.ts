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

  /**
   * Releases locked funds to the invoice issuer.
   * @param invoiceIdHex - The hexadecimal ID of the invoice
   * @param signerPublicKey - The public key that must sign the transaction
   * @returns True if release succeeded
   * @throws Error if simulation fails or transaction submission fails
   */
  async releaseToIssuer(
    invoiceIdHex: string,
    signerPublicKey: string,
  ): Promise<boolean> {
    const args = [xdr.ScVal.scvBytes(Buffer.from(invoiceIdHex, "hex"))];
    return this.writeContract("release_to_issuer", args, signerPublicKey).then(
      () => true,
    );
  }

  /**
   * Releases locked funds to the pool as repayment.
   * @param invoiceIdHex - The hexadecimal ID of the invoice
   * @param repaymentAmount - The amount being repaid (in stroops)
   * @param signerPublicKey - The public key that must sign the transaction
   * @returns True if release succeeded
   * @throws Error if simulation fails or transaction submission fails
   */
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

  /**
   * Handles default scenario by releasing locked funds according to pool rules.
   * @param invoiceIdHex - The hexadecimal ID of the defaulted invoice
   * @param signerPublicKey - The public key that must sign the transaction
   * @returns True if handling succeeded
   * @throws Error if simulation fails or transaction submission fails
   */
  async handleDefault(
    invoiceIdHex: string,
    signerPublicKey: string,
  ): Promise<boolean> {
    const args = [xdr.ScVal.scvBytes(Buffer.from(invoiceIdHex, "hex"))];
    return this.writeContract("handle_default", args, signerPublicKey).then(
      () => true,
    );
  }

  /**
   * Retrieves the locked amount for an invoice (read-only).
   * @param invoiceIdHex - The hexadecimal ID of the invoice
   * @param signerPublicKey - The public key for RPC account lookup
   * @returns The locked amount in stroops
   * @throws Error if simulation fails
   */
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
