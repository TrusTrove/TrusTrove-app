import { Address, nativeToScVal, scValToNative } from "@stellar/stellar-sdk";
import { BaseContractClient } from "../base.js";
import { Profile } from "../types/index.js";
import { parseProfile } from "../types/schemas.js";

export class RegistryClient extends BaseContractClient {
  async initialize(
    adminAddress: string,
    signerPublicKey: string,
  ): Promise<string> {
    const args = [new Address(adminAddress).toScVal()];
    return this.writeContract("initialize", args, signerPublicKey);
  }

  async registerIssuer(
    address: string,
    metadata: Record<string, string>,
    signerPublicKey: string,
  ): Promise<string> {
    const args = [new Address(address).toScVal(), nativeToScVal(metadata)];
    return this.writeContract("register_issuer", args, signerPublicKey);
  }

  /**
   * Registers a buyer on-chain.
   * Side effect: stores a `Profile` with `role: Buyer` and `verified: true`.
   *
   * @param address - The Stellar address to register as a buyer. Must match `signerPublicKey`.
   * @param metadata - Arbitrary key-value metadata stored alongside the buyer profile.
   * @param signerPublicKey - The Stellar public key that will sign the transaction. `address.require_auth()` is enforced on-chain.
   * @returns The transaction hash of the on-chain submission.
   * @throws If the address is already registered (`AlreadyRegistered`), the transaction simulation fails, or on-chain submission errors.
   */
  async registerBuyer(
    address: string,
    metadata: Record<string, string>,
    signerPublicKey: string,
  ): Promise<string> {
    const args = [new Address(address).toScVal(), nativeToScVal(metadata)];
    return this.writeContract("register_buyer", args, signerPublicKey);
  }

  /**
   * Checks whether an address is verified in the on-chain registry.
   * This is a read-only (simulated) call — no on-chain side effects.
   *
   * @param address - The Stellar address to check.
   * @param signerPublicKey - The Stellar public key used to simulate the read call.
   * @returns `true` if the address is registered and verified, `false` otherwise (does not panic for unknown addresses).
   * @throws If the simulation fails.
   */
  async isVerified(address: string, signerPublicKey: string): Promise<boolean> {
    const args = [new Address(address).toScVal()];
    return this.readContract(
      "is_verified",
      args,
      signerPublicKey,
      (val) => !!scValToNative(val),
    );
  }

  /**
   * Retrieves the full on-chain profile for a registered address.
   * This is a read-only (simulated) call — no on-chain side effects.
   *
   * @param address - The Stellar address to look up.
   * @param signerPublicKey - The Stellar public key used to simulate the read call.
   * @returns The parsed {@link Profile} object containing address, role, verified status, and registration timestamp.
   * @throws If the address is not registered (`NotFound`), the simulation fails, or the return value cannot be parsed.
   */
  async getProfile(address: string, signerPublicKey: string): Promise<Profile> {
    const args = [new Address(address).toScVal()];
    return this.readContract("get_profile", args, signerPublicKey, (val) =>
      parseProfile(scValToNative(val)),
    );
  }

  /**
   * Revokes an address's verified status on-chain. Admin only.
   * Side effect: sets `verified: false` on the profile. The address can no longer participate in new invoice transactions.
   *
   * @param address - The Stellar address to revoke.
   * @param signerPublicKey - The Stellar public key that will sign the transaction. Must be the registry admin.
   * @returns The transaction hash of the on-chain submission.
   * @throws If the signer is not the admin, the address is not registered, the transaction simulation fails, or on-chain submission errors.
   */
  async revoke(address: string, signerPublicKey: string): Promise<string> {
    const args = [new Address(address).toScVal()];
    return this.writeContract("revoke", args, signerPublicKey);
  }
}
