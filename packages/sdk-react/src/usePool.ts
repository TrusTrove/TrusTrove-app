import { useMemo } from "react";
import { PoolClient, PoolStats, LPPosition } from "@trusttrove/sdk";
import {
  useAsyncQuery,
  useAsyncMutation,
  AsyncQueryState,
  AsyncMutationState,
} from "./async.js";

export interface UsePoolOptions {
  /**
   * An already-configured PoolClient instance. When provided it is used
   * as-is, so callers control RPC/network and contract addressing without
   * depending on app-specific environment variables.
   */
  client?: PoolClient;
  /**
   * The pool contract ID to construct a client for. Ignored when `client`
   * is also provided.
   */
  contractId?: string;
}

function poolClient(options: UsePoolOptions): PoolClient {
  if (options.client) return options.client;
  if (options.contractId) return new PoolClient(options.contractId);
  throw new Error(
    "usePool: provide an injected PoolClient instance or a contractId",
  );
}

/**
 * Watches aggregate pool statistics. Wraps `PoolClient.getStats()`.
 *
 * @param signerPublicKey - Public key used to simulate the read call.
 * @param options - Injected client instance or contract ID.
 */
export function usePoolStats(
  signerPublicKey: string,
  options: UsePoolOptions,
): AsyncQueryState<PoolStats> {
  const client = useMemo(() => poolClient(options), [options]);
  return useAsyncQuery(
    () => client.getStats(signerPublicKey),
    [client, signerPublicKey],
  );
}

/**
 * Watches the LP position for an address. Wraps `PoolClient.getLPPosition()`.
 *
 * @param lp - The Stellar address of the liquidity provider.
 * @param signerPublicKey - Public key used to simulate the read call.
 * @param options - Injected client instance or contract ID.
 */
export function useLPPosition(
  lp: string,
  signerPublicKey: string,
  options: UsePoolOptions,
): AsyncQueryState<LPPosition> {
  const client = useMemo(() => poolClient(options), [options]);
  return useAsyncQuery(
    () => client.getLPPosition(lp, signerPublicKey),
    [client, lp, signerPublicKey],
  );
}

export interface UsePoolMutationsOptions {
  /**
   * An already-configured PoolClient instance. When provided it is used
   * as-is, so callers control RPC/network and contract addressing without
   * depending on app-specific environment variables.
   */
  client?: PoolClient;
  /**
   * The pool contract ID to construct a client for. Ignored when `client`
   * is also provided.
   */
  contractId?: string;
}

export interface PoolMutationResult {
  /** Deposit USDC into the pool (`PoolClient.deposit`). */
  deposit: AsyncMutationState<[lp: string, usdcAmount: bigint], string>;
  /** Withdraw LP shares from the pool (`PoolClient.withdraw`). */
  withdraw: AsyncMutationState<[lp: string, shares: bigint], string>;
}

/**
 * Exposes write mutations on the pool contract. Each mutation carries its own
 * pending/error state and rethrows failures for local handling.
 *
 * @param signerPublicKey - Public key that will sign each transaction.
 * @param options - Injected client instance or contract ID.
 */
export function usePoolMutations(
  signerPublicKey: string,
  options: UsePoolMutationsOptions,
): PoolMutationResult {
  const client = useMemo(() => poolClient(options), [options]);

  const deposit = useAsyncMutation((lp: string, usdcAmount: bigint) =>
    client.deposit(lp, usdcAmount, signerPublicKey),
  );
  const withdraw = useAsyncMutation((lp: string, shares: bigint) =>
    client.withdraw(lp, shares, signerPublicKey),
  );

  return { deposit, withdraw };
}
