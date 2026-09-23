import { useMemo } from "react";
import { RegistryClient, Profile } from "@trusttrove/sdk";
import {
  useAsyncQuery,
  useAsyncMutation,
  AsyncQueryState,
  AsyncMutationState,
} from "./async.js";

export interface UseRegistryOptions {
  /**
   * An already-configured RegistryClient instance. When provided it is used
   * as-is, so callers control RPC/network and contract addressing without
   * depending on app-specific environment variables.
   */
  client?: RegistryClient;
  /**
   * The registry contract ID to construct a client for. Ignored when `client`
   * is also provided.
   */
  contractId?: string;
}

function registryClient(options: UseRegistryOptions): RegistryClient {
  if (options.client) return options.client;
  if (options.contractId) return new RegistryClient(options.contractId);
  throw new Error(
    "useRegistry: provide an injected RegistryClient instance or a contractId",
  );
}

/**
 * Watches whether an address is verified on-chain. Wraps
 * `RegistryClient.isVerified()`.
 *
 * @param address - The Stellar address to check.
 * @param signerPublicKey - Public key used to simulate the read call.
 * @param options - Injected client instance or contract ID.
 */
export function useIsVerified(
  address: string,
  signerPublicKey: string,
  options: UseRegistryOptions,
): AsyncQueryState<boolean> {
  const client = useMemo(() => registryClient(options), [options]);
  return useAsyncQuery(
    () => client.isVerified(address, signerPublicKey),
    [client, address, signerPublicKey],
  );
}

/**
 * Watches the on-chain profile for an address. Wraps `RegistryClient.getProfile()`.
 *
 * @param address - The Stellar address to look up.
 * @param signerPublicKey - Public key used to simulate the read call.
 * @param options - Injected client instance or contract ID.
 */
export function useProfile(
  address: string,
  signerPublicKey: string,
  options: UseRegistryOptions,
): AsyncQueryState<Profile> {
  const client = useMemo(() => registryClient(options), [options]);
  return useAsyncQuery(
    () => client.getProfile(address, signerPublicKey),
    [client, address, signerPublicKey],
  );
}

export interface UseRegistryMutationsOptions {
  /**
   * An already-configured RegistryClient instance. When provided it is used
   * as-is, so callers control RPC/network and contract addressing without
   * depending on app-specific environment variables.
   */
  client?: RegistryClient;
  /**
   * The registry contract ID to construct a client for. Ignored when `client`
   * is also provided.
   */
  contractId?: string;
}

export interface RegistryMutationResult {
  /** Register an address as a verified issuer (`RegistryClient.registerIssuer`). */
  registerIssuer: AsyncMutationState<
    [address: string, metadata: Record<string, string>],
    string
  >;
  /** Register an address as a verified buyer (`RegistryClient.registerBuyer`). */
  registerBuyer: AsyncMutationState<
    [address: string, metadata: Record<string, string>],
    string
  >;
  /** Revoke an address's verified status (`RegistryClient.revoke`). */
  revoke: AsyncMutationState<[address: string], string>;
}

/**
 * Exposes write mutations on the registry. Each mutation carries its own
 * pending/error state and rethrows failures for local handling.
 *
 * @param signerPublicKey - Public key that will sign each transaction.
 * @param options - Injected client instance or contract ID.
 */
export function useRegistryMutations(
  signerPublicKey: string,
  options: UseRegistryMutationsOptions,
): RegistryMutationResult {
  const client = useMemo(() => registryClient(options), [options]);

  const registerIssuer = useAsyncMutation(
    (address: string, metadata: Record<string, string>) =>
      client.registerIssuer(address, metadata, signerPublicKey),
  );
  const registerBuyer = useAsyncMutation(
    (address: string, metadata: Record<string, string>) =>
      client.registerBuyer(address, metadata, signerPublicKey),
  );
  const revoke = useAsyncMutation((address: string) =>
    client.revoke(address, signerPublicKey),
  );

  return { registerIssuer, registerBuyer, revoke };
}
