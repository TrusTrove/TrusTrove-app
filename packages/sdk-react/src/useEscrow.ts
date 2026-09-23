import { useMemo } from "react";
import { EscrowClient } from "@trusttrove/sdk";
import {
  useAsyncQuery,
  useAsyncMutation,
  AsyncQueryState,
  AsyncMutationState,
} from "./async.js";

export interface UseEscrowOptions {
  /**
   * An already-configured EscrowClient instance. When provided it is used
   * as-is, so callers control RPC/network and contract addressing without
   * depending on app-specific environment variables.
   */
  client?: EscrowClient;
  /**
   * The escrow contract ID to construct a client for. Ignored when `client`
   * is also provided.
   */
  contractId?: string;
}

function escrowClient(options: UseEscrowOptions): EscrowClient {
  if (options.client) return options.client;
  if (options.contractId) return new EscrowClient(options.contractId);
  throw new Error(
    "useEscrow: provide an injected EscrowClient instance or a contractId",
  );
}

/**
 * Watches the locked amount for an invoice. Wraps `EscrowClient.getLocked()`.
 *
 * @param invoiceIdHex - The invoice ID as a 32-byte hex string.
 * @param signerPublicKey - Public key used to simulate the read call.
 * @param options - Injected client instance or contract ID.
 */
export function useLockedAmount(
  invoiceIdHex: string,
  signerPublicKey: string,
  options: UseEscrowOptions,
): AsyncQueryState<bigint> {
  const client = useMemo(() => escrowClient(options), [options]);
  return useAsyncQuery(
    () => client.getLocked(invoiceIdHex, signerPublicKey),
    [client, invoiceIdHex, signerPublicKey],
  );
}

export interface UseEscrowMutationsOptions {
  /**
   * An already-configured EscrowClient instance. When provided it is used
   * as-is, so callers control RPC/network and contract addressing without
   * depending on app-specific environment variables.
   */
  client?: EscrowClient;
  /**
   * The escrow contract ID to construct a client for. Ignored when `client`
   * is also provided.
   */
  contractId?: string;
}

export interface EscrowMutationResult {
  /** Lock USDC for an invoice (`EscrowClient.lock`). */
  lock: AsyncMutationState<[invoiceIdHex: string, amount: bigint], boolean>;
  /** Release locked funds to the invoice issuer (`EscrowClient.releaseToIssuer`). */
  releaseToIssuer: AsyncMutationState<[invoiceIdHex: string], boolean>;
  /** Release locked funds to the pool as repayment (`EscrowClient.releaseToPool`). */
  releaseToPool: AsyncMutationState<
    [invoiceIdHex: string, repaymentAmount: bigint],
    boolean
  >;
  handleDefault: AsyncMutationState<[invoiceIdHex: string], boolean>;
}

/**
 * Exposes write mutations on the escrow contract. Each mutation carries its
 * own pending/error state and rethrows failures for local handling.
 *
 * @param signerPublicKey - Public key that will sign each transaction.
 * @param options - Injected client instance or contract ID.
 */
export function useEscrowMutations(
  signerPublicKey: string,
  options: UseEscrowMutationsOptions,
): EscrowMutationResult {
  const client = useMemo(() => escrowClient(options), [options]);

  const lock = useAsyncMutation((invoiceIdHex: string, amount: bigint) =>
    client.lock(invoiceIdHex, amount, signerPublicKey),
  );
  const releaseToIssuer = useAsyncMutation((invoiceIdHex: string) =>
    client.releaseToIssuer(invoiceIdHex, signerPublicKey),
  );
  const releaseToPool = useAsyncMutation(
    (invoiceIdHex: string, repaymentAmount: bigint) =>
      client.releaseToPool(invoiceIdHex, repaymentAmount, signerPublicKey),
  );
  const handleDefault = useAsyncMutation((invoiceIdHex: string) =>
    client.handleDefault(invoiceIdHex, signerPublicKey),
  );

  return { lock, releaseToIssuer, releaseToPool, handleDefault };
}
