import {
  Address,
  nativeToScVal,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { BaseContractClient } from "../base.js";
import { LPPosition, PoolStats } from "../types/index.js";
import { parsePoolStats, parseLPPosition } from "../types/schemas.js";

export class PoolClient extends BaseContractClient {
  async initialize(
    adminAddress: string,
    signerPublicKey: string,
  ): Promise<string> {
    const args = [new Address(adminAddress).toScVal()];
    return this.writeContract("initialize", args, signerPublicKey);
  }

  async deposit(
    lp: string,
    usdcAmount: bigint,
    signerPublicKey: string,
  ): Promise<string> {
    const args = [
      new Address(lp).toScVal(),
      nativeToScVal(usdcAmount, { type: "u128" }),
    ];
    return this.writeContract("deposit", args, signerPublicKey);
  }

  async withdraw(
    lp: string,
    shares: bigint,
    signerPublicKey: string,
  ): Promise<string> {
    const args = [
      new Address(lp).toScVal(),
      nativeToScVal(shares, { type: "u128" }),
    ];
    return this.writeContract("withdraw", args, signerPublicKey);
  }

  async fundInvoice(
    invoiceIdHex: string,
    signerPublicKey: string,
  ): Promise<boolean> {
    const args = [xdr.ScVal.scvBytes(Buffer.from(invoiceIdHex, "hex"))];
    return this.writeContract("fund_invoice", args, signerPublicKey).then(
      () => true,
    );
  }

  async receiveRepayment(
    invoiceIdHex: string,
    amount: bigint,
    signerPublicKey: string,
  ): Promise<boolean> {
    const args = [
      xdr.ScVal.scvBytes(Buffer.from(invoiceIdHex, "hex")),
      nativeToScVal(amount, { type: "u128" }),
    ];
    return this.writeContract("receive_repayment", args, signerPublicKey).then(
      () => true,
    );
  }

  async getStats(signerPublicKey: string): Promise<PoolStats> {
    const args: xdr.ScVal[] = [];
    return this.readContract("get_stats", args, signerPublicKey, (val) =>
      parsePoolStats(scValToNative(val)),
    );
  }

  async getLPPosition(
    lp: string,
    signerPublicKey: string,
  ): Promise<LPPosition> {
    const args = [new Address(lp).toScVal()];
    return this.readContract("get_lp_position", args, signerPublicKey, (val) =>
      parseLPPosition(scValToNative(val)),
    );
  }

  async getUtilizationRate(signerPublicKey: string): Promise<number> {
    const args: xdr.ScVal[] = [];
    return this.readContract(
      "get_utilization_rate",
      args,
      signerPublicKey,
      (val) => Number(scValToNative(val) || 0),
    );
  }
}
