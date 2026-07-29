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
