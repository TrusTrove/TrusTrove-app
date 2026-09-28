import { useMemo } from "react";
import { InvoiceClient, Invoice } from "@trusttrove/sdk";
import {
  useAsyncQuery,
  useAsyncMutation,
  AsyncQueryState,
  AsyncMutationState,
} from "./async.js";

export interface UseInvoiceOptions {
  /**
   * An already-configured InvoiceClient instance. When provided it is used
   * as-is, so callers control RPC/network and contract addressing without
   * depending on app-specific environment variables.
   */
  client?: InvoiceClient;
  /**
   * The invoice contract ID to construct a client for. Ignored when `client`
   * is also provided.
   */
  contractId?: string;
}

function invoiceClient(options: UseInvoiceOptions): InvoiceClient {
  if (options.client) return options.client;
  if (options.contractId) return new InvoiceClient(options.contractId);
  throw new Error(
    "useInvoice: provide an injected InvoiceClient instance or a contractId",
  );
}

/**
 * Watches a single invoice by its on-chain ID. Wraps `InvoiceClient.get()`.
 *
 * @param invoiceIdHex - The invoice ID as a 32-byte hex string.
 * @param signerPublicKey - Public key used to simulate the read call.
 * @param options - Injected client instance or contract ID.
 */
export function useInvoice(
  invoiceIdHex: string,
  signerPublicKey: string,
  options: UseInvoiceOptions,
): AsyncQueryState<Invoice> {
  const client = useMemo(() => invoiceClient(options), [options]);
  return useAsyncQuery(
    () => client.get(invoiceIdHex, signerPublicKey),
    [client, invoiceIdHex, signerPublicKey],
  );
}

export interface UseInvoiceMutationsOptions {
  /**
   * An already-configured InvoiceClient instance. When provided it is used
   * as-is, so callers control RPC/network and contract addressing without
   * depending on app-specific environment variables.
   */
  client?: InvoiceClient;
  /**
   * The invoice contract ID to construct a client for. Ignored when `client`
   * is also provided.
   */
  contractId?: string;
}

export interface InvoiceMutationResult {
  /** Create a new invoice (`InvoiceClient.create`). */
  create: AsyncMutationState<
    [issuer: string, buyer: string, faceValue: bigint, dueDate: number],
    string
  >;
  /** List an invoice for financing (`InvoiceClient.listForFinancing`). */
  listForFinancing: AsyncMutationState<
    [invoiceIdHex: string, discountBps: number],
    boolean
  >;
  /** Mark an invoice as shipped (`InvoiceClient.markShipped`). */
  markShipped: AsyncMutationState<[invoiceIdHex: string], boolean>;
  /** Confirm delivery (`InvoiceClient.confirmDelivery`). */
  confirmDelivery: AsyncMutationState<
    [invoiceIdHex: string, confirmerAddress: string],
    boolean
  >;
  /** Repay a financed invoice (`InvoiceClient.repay`). */
  repay: AsyncMutationState<[invoiceIdHex: string], boolean>;
  /** Trigger a default on an overdue invoice (`InvoiceClient.triggerDefault`). */
  triggerDefault: AsyncMutationState<[invoiceIdHex: string], boolean>;
}

/**
 * Exposes write mutations on the invoice contract. Each mutation carries its
 * own pending/error state and rethrows failures for local handling.
 *
 * @param signerPublicKey - Public key that will sign each transaction.
 * @param options - Injected client instance or contract ID.
 */
export function useInvoiceMutations(
  signerPublicKey: string,
  options: UseInvoiceMutationsOptions,
): InvoiceMutationResult {
  const client = useMemo(() => invoiceClient(options), [options]);

  const create = useAsyncMutation(
    (issuer: string, buyer: string, faceValue: bigint, dueDate: number) =>
      client.create(issuer, buyer, faceValue, dueDate, signerPublicKey),
  );
  const listForFinancing = useAsyncMutation(
    (invoiceIdHex: string, discountBps: number) =>
      client.listForFinancing(invoiceIdHex, discountBps, signerPublicKey),
  );
  const markShipped = useAsyncMutation((invoiceIdHex: string) =>
    client.markShipped(invoiceIdHex, signerPublicKey),
  );
  const confirmDelivery = useAsyncMutation(
    (invoiceIdHex: string, confirmerAddress: string) =>
      client.confirmDelivery(invoiceIdHex, confirmerAddress, signerPublicKey),
  );
  const repay = useAsyncMutation((invoiceIdHex: string) =>
    client.repay(invoiceIdHex, signerPublicKey),
  );
  const triggerDefault = useAsyncMutation((invoiceIdHex: string) =>
    client.triggerDefault(invoiceIdHex, signerPublicKey),
  );

  return {
    create,
    listForFinancing,
    markShipped,
    confirmDelivery,
    repay,
    triggerDefault,
  };
}
