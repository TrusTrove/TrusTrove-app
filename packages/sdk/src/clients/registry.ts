import { Address, nativeToScVal, scValToNative } from '@stellar/stellar-sdk';
import { BaseContractClient } from '../base.js';
import { Profile } from '../types/index.js';
import { parseProfile } from '../types/schemas.js';

export class RegistryClient extends BaseContractClient {
  async initialize(adminAddress: string, signerPublicKey: string): Promise<string> {
    const args = [new Address(adminAddress).toScVal()];
    return this.writeContract('initialize', args, signerPublicKey);
  }

  async registerIssuer(
    address: string,
    metadata: Record<string, string>,
    signerPublicKey: string
  ): Promise<string> {
    const args = [
      new Address(address).toScVal(),
      nativeToScVal(metadata),
    ];
    return this.writeContract('register_issuer', args, signerPublicKey);
  }

  async registerBuyer(
    address: string,
    metadata: Record<string, string>,
    signerPublicKey: string
  ): Promise<string> {
    const args = [
      new Address(address).toScVal(),
      nativeToScVal(metadata),
    ];
    return this.writeContract('register_buyer', args, signerPublicKey);
  }

  async isVerified(address: string, signerPublicKey: string): Promise<boolean> {
    const args = [new Address(address).toScVal()];
    return this.readContract(
      'is_verified',
      args,
      signerPublicKey,
      (val) => !!scValToNative(val)
    );
  }

  async getProfile(address: string, signerPublicKey: string): Promise<Profile> {
    const args = [new Address(address).toScVal()];
    return this.readContract(
      'get_profile',
      args,
      signerPublicKey,
      (val) => parseProfile(scValToNative(val))
    );
  }

  async revoke(address: string, signerPublicKey: string): Promise<string> {
    const args = [new Address(address).toScVal()];
    return this.writeContract('revoke', args, signerPublicKey);
  }
}
