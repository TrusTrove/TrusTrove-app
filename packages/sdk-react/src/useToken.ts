import { useMemo } from "react";
import { TokenClient } from "@trusttrove/sdk";
import {
  useAsyncQuery,
  useAsyncMutation,
  AsyncQueryState,
  AsyncMutationState,
} from "./async.js";

export interface UseTokenOptions {
  /**
   * An already-configured TokenClient instance (e.g. via
   * `TokenClient.forUSDC()` or a passed-in instance). When provided it is
   * used as-is, so callers control RPC/network and contract addressing
   * without depending on app-specific environment variables.
   */
  client?: TokenClient;
  /**
   * The token (SAC) contract ID to construct a client for. Ignored when
   * `client` is also provided.
   */
  contractId?: string;
}

function tokenClient(options: UseTokenOptions): TokenClient {
  if (options.client) return options.client;
  if (options.contractId) return new TokenClient(options.contractId);
  throw new Error(
    "useToken: provide an injected TokenClient instance or a contractId",
  );
}

/**
 * Watches the token allowance granted by `from` to `spender`. Wraps
 * `TokenClient.allowance()`.
 *
 * @param from - The address that granted the allowance.
 * @param spender - The address (typically a contract) permitted to spend tokens.
 * @param signerPublicKey - Public key used to simulate the read call.
 * @param options - Injected client instance or contract ID.
 */
export function useAllowance(
  from: string,
  spender: string,
  signerPublicKey: string,
  options: UseTokenOptions,
): AsyncQueryState<bigint> {
  const client = useMemo(() => tokenClient(options), [options]);
  return useAsyncQuery(
    () => client.allowance(from, spender, signerPublicKey),
    [client, from, spender, signerPublicKey],
  );
}

export interface UseApproveOptions {
  /**
   * An already-configured TokenClient instance (e.g. via
   * `TokenClient.forUSDC()` or a passed-in instance). When provided it is
   * used as-is, so callers control RPC/network and contract addressing
   * without depending on app-specific environment variables.
   */
  client?: TokenClient;
  /**
   * The token (SAC) contract ID to construct a client for. Ignored when
   * `client` is also provided.
   */
  contractId?: string;
}

export interface ApproveMutationResult {
  /** Approve a spender (`TokenClient.approve`). */
  approve: AsyncMutationState<
    [from: string, spender: string, amount: bigint, expirationLedger: number],
    string
  >;
}

/**
 * Exposes the token approve mutation with pending/error state. Rethrows
 * failures for local handling.
 *
 * @param signerPublicKey - Public key that will sign the transaction.
 * @param options - Injected client instance or contract ID.
 */
export function useApprove(
  signerPublicKey: string,
  options: UseApproveOptions,
): ApproveMutationResult {
  const client = useMemo(() => tokenClient(options), [options]);

  const approve = useAsyncMutation(
    (from: string, spender: string, amount: bigint, expirationLedger: number) =>
      client.approve(from, spender, amount, expirationLedger, signerPublicKey),
  );

  return { approve };
}
