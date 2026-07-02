import { Address, Asset, nativeToScVal, scValToNative, xdr } from '@stellar/stellar-sdk';
import { BaseContractClient } from '../base.js';
import { getConfig } from '../config.js';

/**
 * Client for interacting with a Stellar Asset Contract (SAC).
 *
 * Wraps the SEP-41 token interface methods `allowance` and `approve` so that
 * callers can check and set spending permissions before invoking contracts that
 * perform `transfer_from` on behalf of the user.
 *
 * The SAC contract ID is derived deterministically from the asset code, issuer,
 * and network passphrase at construction time.
 *
 * @example
 * ```ts
 * const usdc = TokenClient.forUSDC();
 * const allowed = await usdc.allowance(userAddr, poolContractId, userAddr);
 * if (allowed < depositAmount) {
 *   await usdc.approve(userAddr, poolContractId, depositAmount, expirationLedger, userAddr);
 * }
 * ```
 */
export class TokenClient extends BaseContractClient {
  /**
   * Creates a TokenClient for the USDC Stellar Asset Contract using the
   * issuer and network passphrase from the active SDK configuration.
   */
  static forUSDC(): TokenClient {
    const config = getConfig();
    const asset = new Asset(config.usdc.assetCode, config.usdc.issuer);
    const sacContractId = asset.contractId(config.networkPassphrase);
    return new TokenClient(sacContractId);
  }

  /**
   * Reads the current token allowance granted by `from` to `spender`.
   *
   * @param from - The address that granted the allowance.
   * @param spender - The address (typically a contract) permitted to spend tokens.
   * @param signerPublicKey - Public key used to simulate the read transaction.
   * @returns The current allowance as a `bigint` (in stroops / smallest unit).
   */
  async allowance(
    from: string,
    spender: string,
    signerPublicKey: string
  ): Promise<bigint> {
    const args: xdr.ScVal[] = [
      new Address(from).toScVal(),
      new Address(spender).toScVal(),
    ];
    return this.readContract(
      'allowance',
      args,
      signerPublicKey,
      (val) => {
        const native = scValToNative(val);
        return typeof native === 'bigint' ? native : BigInt(String(native || 0));
      }
    );
  }

  /**
   * Approves `spender` to transfer up to `amount` tokens from the caller's
   * account. The approval is valid until `expirationLedger`.
   *
   * This triggers a Freighter wallet signing prompt for the user.
   *
   * @param from - The token owner granting approval.
   * @param spender - The contract address being approved to spend tokens.
   * @param amount - Maximum amount the spender may transfer (in stroops).
   * @param expirationLedger - Ledger sequence number at which the approval expires.
   * @param signerPublicKey - Public key used to sign and submit the transaction.
   * @returns The on-chain transaction hash.
   */
  async approve(
    from: string,
    spender: string,
    amount: bigint,
    expirationLedger: number,
    signerPublicKey: string
  ): Promise<string> {
    const args: xdr.ScVal[] = [
      new Address(from).toScVal(),
      new Address(spender).toScVal(),
      nativeToScVal(amount, { type: 'i128' }),
      nativeToScVal(expirationLedger, { type: 'u32' }),
    ];
    return this.writeContract('approve', args, signerPublicKey);
  }
}
