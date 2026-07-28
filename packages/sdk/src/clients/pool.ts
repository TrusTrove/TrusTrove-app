import { Address, nativeToScVal } from "@stellar/stellar-sdk";
import { BaseClient } from "../base";

export type PoolAsset = string;

export class PoolClient extends BaseClient {
  async deposit(
    lp: string,
    amount: bigint,
    asset: PoolAsset,
    signerPublicKey: string,
  ): Promise<string> {
    return this.invoke(
      "deposit",
      [
        new Address(lp).toScVal(),
        nativeToScVal(amount, { type: "u128" }),
        nativeToScVal(asset, { type: "symbol" }),
      ],
      signerPublicKey,
    );
  }

  async withdraw(
    lp: string,
    shares: bigint,
    signerPublicKey: string,
  ): Promise<string> {
    return this.invoke(
      "withdraw",
      [
        new Address(lp).toScVal(),
        nativeToScVal(shares, { type: "u128" }),
      ],
      signerPublicKey,
    );
  }
}
