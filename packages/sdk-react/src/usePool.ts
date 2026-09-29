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

/**
 * Watches the current pool utilization rate in basis points. Wraps
 * `PoolClient.getUtilizationRate()`. Returns `0` when the pool has no
 * deposits.
 *
 * @param signerPublicKey - Public key used to simulate the read call.
 * @param options - Injected client instance or contract ID.
 */
export function useUtilizationRate(
  signerPublicKey: string,
  options: UsePoolOptions,
): AsyncQueryState<number> {
  const client = useMemo(() => poolClient(options), [options]);
  return useAsyncQuery(
    () => client.getUtilizationRate(signerPublicKey),
    [client, signerPublicKey],
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
  /**
   * Fund a listed invoice from pool liquidity (`PoolClient.fundInvoice`).
   * Intended for the funder flow; the web app already uses this operation.
   */
  fundInvoice: AsyncMutationState<[invoiceIdHex: string], boolean>;
  /**
   * Record a repayment into the pool (`PoolClient.receiveRepayment`).
   *
   * Note: on-chain, `receive_repayment` is normally invoked by the invoice
   * contract as part of `InvoiceClient.repay` rather than by end users, so
   * this mutation is exposed for completeness and admin/integration tooling.
   */
  receiveRepayment: AsyncMutationState<
    [invoiceIdHex: string, amount: bigint],
    boolean
  >;
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
  const fundInvoice = useAsyncMutation((invoiceIdHex: string) =>
    client.fundInvoice(invoiceIdHex, signerPublicKey),
  );
  const receiveRepayment = useAsyncMutation(
    (invoiceIdHex: string, amount: bigint) =>
      client.receiveRepayment(invoiceIdHex, amount, signerPublicKey),
  );

  return { deposit, withdraw, fundInvoice, receiveRepayment };
}
