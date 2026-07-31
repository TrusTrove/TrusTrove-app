import {
  Address,
  nativeToScVal,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { BaseContractClient } from "../base.js";
import { Invoice, InvoiceStatus } from "../types/index.js";
import { parseInvoice } from "../types/schemas.js";

export class InvoiceClient extends BaseContractClient {
  async initialize(
    adminAddress: string,
    signerPublicKey: string,
  ): Promise<string> {
    const args = [new Address(adminAddress).toScVal()];
    return this.writeContract("initialize", args, signerPublicKey);
  }

  async create(
    issuer: string,
    buyer: string,
    faceValue: bigint,
    dueDate: number,
    signerPublicKey: string,
  ): Promise<string> {
    const args = [
      new Address(issuer).toScVal(),
      new Address(buyer).toScVal(),
      nativeToScVal(faceValue, { type: "u128" }),
      nativeToScVal(BigInt(dueDate), { type: "u64" }),
    ];
    return this.writeContract("create", args, signerPublicKey);
  }

  /**
   * Lists an existing invoice for public financing on the marketplace.
   * Side effect: the invoice status transitions to `Listed`.
   *
   * @param invoiceIdHex - The invoice ID as a 32-byte hex string.
   * @param discountBps - The discount rate in basis points (e.g. 500 = 5%).
   * @param signerPublicKey - The Stellar public key that will sign the transaction. Must be the invoice issuer.
   * @returns `true` when the transaction succeeds on-chain.
   * @throws If the transaction simulation fails or the on-chain submission errors.
   */
  async listForFinancing(
    invoiceIdHex: string,
    discountBps: number,
    signerPublicKey: string,
  ): Promise<boolean> {
    const args = [
      xdr.ScVal.scvBytes(Buffer.from(invoiceIdHex, "hex")),
      nativeToScVal(discountBps, { type: "u32" }),
    ];
    return this.writeContract("list_for_financing", args, signerPublicKey).then(
      () => true,
    );
  }

  async markShipped(
    invoiceIdHex: string,
    signerPublicKey: string,
  ): Promise<boolean> {
    const args = [xdr.ScVal.scvBytes(Buffer.from(invoiceIdHex, "hex"))];
    return this.writeContract("mark_shipped", args, signerPublicKey).then(
      () => true,
    );
  }

  /**
   * Confirms delivery of goods for an invoice on-chain.
   * Side effect: updates the confirmation status for the provided `confirmerAddress`.
   *
   * @param invoiceIdHex - The invoice ID as a 32-byte hex string.
   * @param confirmerAddress - The Stellar address whose delivery confirmation is being recorded.
   * @param signerPublicKey - The Stellar public key that will sign the transaction. Must be the buyer or issuer.
   * @returns `true` when the transaction succeeds on-chain.
   * @throws If the transaction simulation fails or the on-chain submission errors.
   */
  async confirmDelivery(
    invoiceIdHex: string,
    confirmerAddress: string,
    signerPublicKey: string,
  ): Promise<boolean> {
    const args = [
      xdr.ScVal.scvBytes(Buffer.from(invoiceIdHex, "hex")),
      new Address(confirmerAddress).toScVal(),
    ];
    return this.writeContract("confirm_delivery", args, signerPublicKey).then(
      () => true,
    );
  }

  /**
   * Repays a financed invoice on-chain, returning funds to the liquidity pool.
   * Side effect: the invoice status transitions to `Repaid` and LP yield is distributed.
   *
   * @param invoiceIdHex - The invoice ID as a 32-byte hex string.
   * @param signerPublicKey - The Stellar public key that will sign the transaction. Must be the invoice buyer.
   * @returns `true` when the transaction succeeds on-chain.
   * @throws If the transaction simulation fails or the on-chain submission errors.
   */
  async repay(invoiceIdHex: string, signerPublicKey: string): Promise<boolean> {
    const args = [xdr.ScVal.scvBytes(Buffer.from(invoiceIdHex, "hex"))];
    return this.writeContract("repay", args, signerPublicKey).then(() => true);
  }

  async triggerDefault(
    invoiceIdHex: string,
    signerPublicKey: string,
  ): Promise<boolean> {
    const args = [xdr.ScVal.scvBytes(Buffer.from(invoiceIdHex, "hex"))];
    return this.writeContract("trigger_default", args, signerPublicKey).then(
      () => true,
    );
  }

  /**
   * Retrieves a single invoice by its on-chain ID.
   * This is a read-only (simulated) call — no on-chain side effects.
   *
   * @param invoiceIdHex - The invoice ID as a 32-byte hex string.
   * @param signerPublicKey - The Stellar public key used to simulate the read call.
   * @returns The parsed {@link Invoice} object.
   * @throws If the simulation fails or the return value cannot be parsed.
   */
  async get(invoiceIdHex: string, signerPublicKey: string): Promise<Invoice> {
    const args = [xdr.ScVal.scvBytes(Buffer.from(invoiceIdHex, "hex"))];
    return this.readContract("get", args, signerPublicKey, (val) =>
      parseInvoice(scValToNative(val)),
    );
  }

  async getByStatus(
    status: InvoiceStatus,
    signerPublicKey: string,
  ): Promise<Invoice[]> {
    const args = [nativeToScVal(status, { type: "symbol" })];
    return this.readContract("get_by_status", args, signerPublicKey, (val) => {
      const native = scValToNative(val);
      if (!Array.isArray(native)) return [];
      return native.map(parseInvoice);
    });
  }

  async getByIssuer(
    address: string,
    signerPublicKey: string,
  ): Promise<Invoice[]> {
    const args = [new Address(address).toScVal()];
    return this.readContract("get_by_issuer", args, signerPublicKey, (val) => {
      const native = scValToNative(val);
      if (!Array.isArray(native)) return [];
      return native.map(parseInvoice);
    });
  }

  async getByBuyer(
    address: string,
    signerPublicKey: string,
  ): Promise<Invoice[]> {
    const args = [new Address(address).toScVal()];
    return this.readContract("get_by_buyer", args, signerPublicKey, (val) => {
      const native = scValToNative(val);
      if (!Array.isArray(native)) return [];
      return native.map(parseInvoice);
    });
  }
}
