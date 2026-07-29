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

  /**
   * Withdraws liquidity shares from the pool.
   * @param lp - The public key of the liquidity provider
   * @param shares - Number of shares to withdraw
   * @param signerPublicKey - The public key that must sign the transaction
   * @returns The transaction hash
   * @throws Error if simulation fails or transaction submission fails
   */
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

  /**
   * Funds an invoice from the pool liquidity.
   * @param invoiceIdHex - The hexadecimal ID of the invoice to fund
   * @param signerPublicKey - The public key that must sign the transaction
   * @returns True if funding succeeded
   * @throws Error if simulation fails or transaction submission fails
   */
  async fundInvoice(
    invoiceIdHex: string,
    signerPublicKey: string,
  ): Promise<boolean> {
    const args = [xdr.ScVal.scvBytes(Buffer.from(invoiceIdHex, "hex"))];
    return this.writeContract("fund_invoice", args, signerPublicKey).then(
      () => true,
    );
  }

  /**
   * Records repayment received for a funded invoice.
   * @param invoiceIdHex - The hexadecimal ID of the invoice
   * @param amount - The repayment amount received (in stroops)
   * @param signerPublicKey - The public key that must sign the transaction
   * @returns True if repayment was recorded successfully
   * @throws Error if simulation fails or transaction submission fails
   */
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

  /**
   * Retrieves pool statistics (read-only, no on-chain auth required).
   * @param signerPublicKey - The public key for RPC account lookup
   * @returns Pool statistics including TVL, utilization, and APY
   * @throws Error if simulation fails
   */
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

  /**
   * Gets the current pool utilization rate (read-only).
   * @param signerPublicKey - The public key for RPC account lookup
   * @returns Utilization rate as a decimal (0-1)
   * @throws Error if simulation fails
   */
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
