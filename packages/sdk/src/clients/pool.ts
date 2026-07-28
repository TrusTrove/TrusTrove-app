import { Address, nativeToScVal } from "@stellar/stellar-sdk";
import { BaseClient } from "../base";

export type PoolAsset = "USDC" | "XLM";

export class PoolClient extends BaseClient {
  async deposit(
    lp: string,
    amount: bigint,
    asset: PoolAsset,
    caller: string,
  ): Promise<string> {
    const args = [
      new Address(lp).toScVal(),
      nativeToScVal(amount, { type: "u128" }),
      nativeToScVal(asset, { type: "symbol" }),
    ];

    return this.submitTransaction("deposit", args, caller);
  }

  async withdraw(
    lp: string,
    shares: bigint,
    caller: string,
  ): Promise<string> {
    const args = [
      new Address(lp).toScVal(),
      nativeToScVal(shares, { type: "u128" }),
    ];

    return this.submitTransaction("withdraw", args, caller);
  }
}
