"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { Horizon } from "@stellar/stellar-sdk";
import { useState, useCallback, useEffect, useMemo } from "react";
import type { TxHistoryItem } from "@/types";

const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL || "https://horizon-testnet.stellar.org";

const CONTRACT_IDS = [
  process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID,
  process.env.NEXT_PUBLIC_INVOICE_CONTRACT_ID,
  process.env.NEXT_PUBLIC_POOL_CONTRACT_ID,
  process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID,
].filter(Boolean) as string[];

let horizonServer: Horizon.Server | undefined;

/**
 * Lazily creates (and reuses) the Horizon server client.
 *
 * @returns The shared `Horizon.Server` pointed at {@link HORIZON_URL}.
 */
function getHorizonServer(): Horizon.Server {
  if (!horizonServer) {
    horizonServer = new Horizon.Server(HORIZON_URL);
  }
  return horizonServer;
}

const FUNCTION_LABELS: Record<string, string> = {
  create: "Create Invoice",
  list_for_financing: "List Invoice",
  mark_shipped: "Mark Shipped",
  confirm_delivery: "Confirm Delivery",
  repay: "Repay Invoice",
  trigger_default: "Trigger Default",
  deposit: "Pool Deposit",
  withdraw: "Pool Withdraw",
  fund_invoice: "Fund Invoice",
  receive_repayment: "Receive Repayment",
  register_issuer: "Register Issuer",
  register_buyer: "Register Buyer",
  is_verified: "Verify Identity",
  revoke: "Revoke Profile",
  lock: "Lock Escrow",
  release_to_issuer: "Release to Issuer",
  release_to_pool: "Release to Pool",
  handle_default: "Handle Default",
};

interface HorizonAssetBalanceChange {
  from?: string;
  to?: string;
  amount?: string;
  asset_type?: string;
  asset_code?: string;
}

interface HorizonOperationRecord {
  type?: string;
  type_i?: number;
  amount?: string;
  asset_type?: string;
  asset_code?: string;
  contract_id?: string;
  function?: string;
  asset_balance_changes?: HorizonAssetBalanceChange[];
}

/**
 * Error thrown when Horizon answers with HTTP 429.
 *
 * Horizon rate-limits aggressively, and a dropped operations lookup used to
 * make the offending transaction silently disappear from the history. Surfacing
 * a dedicated error type instead lets callers tell "you are being throttled"
 * apart from a genuine failure.
 */
export class HorizonRateLimitError extends Error {
  /** HTTP status that produced this error. Always `429`. */
  readonly status = 429;

  constructor(
    message = "Horizon rate limit reached (429). Please wait a moment and try again.",
  ) {
    super(message);
    this.name = "HorizonRateLimitError";
  }
}

/**
 * Detects a Horizon 429 response across the shapes the SDK surfaces it in
 * (an axios-style `response.status`, a flat `status`, or already-wrapped).
 *
 * @param err - The rejection value to inspect.
 * @returns `true` when `err` represents a rate-limit response.
 */
export function isRateLimitError(err: unknown): boolean {
  if (err instanceof HorizonRateLimitError) return true;
  if (typeof err !== "object" || err === null) return false;

  const candidate = err as {
    status?: unknown;
    response?: { status?: unknown };
  };
  return candidate.status === 429 || candidate.response?.status === 429;
}

/** How long a cached per-transaction operations lookup is kept in memory. */
const TX_OPS_GC_TIME = 30 * 60 * 1000;

/**
 * Builds the react-query key for one transaction's operations.
 *
 * Keying on the transaction hash (rather than on the page cursor) is what makes
 * paging cheap: operations of a closed transaction are immutable, so a hash
 * that has been fetched once is never fetched again, no matter how often the
 * user pages back and forth over it.
 *
 * @param hash - Transaction hash.
 * @returns The query key for that transaction's operations.
 */
export function txOpsQueryKey(hash: string) {
  return ["txOps", HORIZON_URL, hash] as const;
}

/** Fetches every operation of one transaction, mapping 429s to a typed error. */
async function fetchOperationsForTx(
  hash: string,
): Promise<HorizonOperationRecord[]> {
  try {
    const page = await getHorizonServer()
      .operations()
      .forTransaction(hash)
      .limit(200)
      .call();
    return page.records as HorizonOperationRecord[];
  } catch (err) {
    if (isRateLimitError(err)) throw new HorizonRateLimitError();
    throw err;
  }
}

/**
 * Returns a per-transaction operations fetcher backed by the react-query cache.
 *
 * @param queryClient - The active react-query client.
 * @returns A function that resolves a transaction hash to its operations,
 *   issuing at most one Horizon request per hash.
 */
export function createCachedOpsFetcher(queryClient: QueryClient) {
  return (hash: string) =>
    queryClient.fetchQuery({
      queryKey: txOpsQueryKey(hash),
      queryFn: () => fetchOperationsForTx(hash),
      // Operations of a closed transaction never change.
      staleTime: Infinity,
      gcTime: TX_OPS_GC_TIME,
      retry: false,
    });
}

function getTxType(funcName: string): string {
  return FUNCTION_LABELS[funcName] || "Contract Invocation";
}

export function extractOpAmount(
  op: HorizonOperationRecord,
  userAddress: string,
): { amount: string; token: string } | undefined {
  const type = op.type;
  const typeI = op.type_i;

  if (type === "payment" || typeI === 1) {
    const amount = op.amount;
    const token = op.asset_type === "native" ? "XLM" : op.asset_code;
    if (!amount || !token) return undefined;
    return { amount, token };
  }

  if (type === "invoke_host_function" || typeI === 24) {
    if (!op.asset_balance_changes?.length) return undefined;
    const relevant = op.asset_balance_changes.find(
      (change) => change.from === userAddress || change.to === userAddress,
    );
    if (relevant) {
      const amount = relevant.amount;
      const token =
        relevant.asset_type === "native" ? "XLM" : relevant.asset_code;
      if (!amount || !token) return undefined;
      return { amount, token };
    }
  }

  return undefined;
}

export interface TxHistoryResult {
  transactions: TxHistoryItem[];
  isLoading: boolean;
  error: Error | null;
  hasNext: boolean;
  hasPrev: boolean;
  goNext: () => void;
  goPrev: () => void;
  page: number;
  refetch: () => void;
}

/** Resolves a transaction hash to its Horizon operations. */
export type OpsFetcher = (hash: string) => Promise<HorizonOperationRecord[]>;

/**
 * Fetches one page of transactions plus the operations of each transaction on
 * it, reusing whatever the per-hash cache already holds.
 *
 * @param address - Stellar account address to page over.
 * @param cursor - Horizon paging token for the page to load, or `undefined` for
 *   the first page.
 * @param fetchOps - Per-transaction operations fetcher; pass
 *   {@link createCachedOpsFetcher} so a hash is only ever fetched once.
 * @returns The page's {@link TxHistoryItem}s and the cursor for the next page
 *   (`null` when this is the last page).
 *
 * @throws {HorizonRateLimitError} When Horizon answers any of the requests with
 *   HTTP 429, instead of dropping the affected transactions.
 */
export async function fetchPage(
  address: string,
  cursor: string | undefined,
  fetchOps: OpsFetcher,
) {
  const server = getHorizonServer();

  let txQuery = server
    .transactions()
    .forAccount(address)
    .limit(10)
    .order("desc");

  if (cursor) {
    txQuery = txQuery.cursor(cursor);
  }

  let txPage;
  try {
    txPage = await txQuery.call();
  } catch (err) {
    if (isRateLimitError(err)) throw new HorizonRateLimitError();
    throw err;
  }

  if (txPage.records.length === 0) {
    return { items: [], nextCursor: null };
  }

  const opsResults = await Promise.allSettled(
    txPage.records.map((tx) => fetchOps(tx.hash)),
  );

  // Being throttled is not the same as "this transaction has no contract ops":
  // fail the page loudly so the UI can tell the user to back off, rather than
  // rendering a silently incomplete history.
  if (
    opsResults.some(
      (r) => r.status === "rejected" && isRateLimitError(r.reason),
    )
  ) {
    throw new HorizonRateLimitError();
  }

  const items: TxHistoryItem[] = [];

  for (let i = 0; i < txPage.records.length; i++) {
    const tx = txPage.records[i];
    const opsResult = opsResults[i];

    if (opsResult.status === "rejected") continue;

    const ops = opsResult.value;
    const matchingOps = ops.filter(
      (op) => op.contract_id && CONTRACT_IDS.includes(op.contract_id),
    );

    if (matchingOps.length === 0) continue;

    const mainOp = matchingOps[0];
    const type = getTxType(mainOp.function ?? "");
    const amountToken = extractOpAmount(mainOp, address);

    items.push({
      id: tx.hash,
      type,
      amount: amountToken?.amount,
      token: amountToken?.token,
      timestamp: new Date(tx.created_at).getTime() / 1000,
      hash: tx.hash,
      status: tx.successful ? "success" : "failed",
    });
  }

  const lastRecord = txPage.records[txPage.records.length - 1];
  const nextCursor =
    txPage.records.length === 10 ? lastRecord.paging_token : null;

  return { items, nextCursor };
}

/**
 * Custom hook for fetching paginated transaction history from the Stellar Horizon API.
 *
 * Queries transactions for the given account address, filtering to only those
 * involving known TrusTrove contracts (Registry, Invoice, Pool, Escrow).
 * Supports client-side pagination with a cursor stack.
 *
 * @param address - Stellar account address to fetch transaction history for.
 * @returns An object containing:
 *   - `transactions` — Array of {@link TxHistoryItem} for the current page.
 *   - `isLoading` — `true` while the transaction page is being fetched.
 *   - `error` — Fetch error, or `null` if none.
 *   - `hasNext` — Whether a next page of transactions exists.
 *   - `hasPrev` — Whether a previous page of transactions exists.
 *   - `goNext` — Navigate to the next page.
 *   - `goPrev` — Navigate to the previous page.
 *   - `page` — Current 1-indexed page number.
 *   - `refetch` — Function to manually re-fetch the current page.
 *
 * @example
 * ```tsx
 * const { transactions, isLoading, hasNext, goNext } = useTxHistory(address);
 * ```
 */
export function useTxHistory(address: string): TxHistoryResult {
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([
    undefined,
  ]);
  const [page, setPage] = useState(0);
  const cursor = cursorStack[page];
  const queryClient = useQueryClient();

  // One fetcher instance per client so the per-tx-hash cache survives paging.
  const fetchOps = useMemo(
    () => createCachedOpsFetcher(queryClient),
    [queryClient],
  );

  useEffect(() => {
    setCursorStack([undefined]);
    setPage(0);
  }, [address]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["txHistory", address, cursor],
    queryFn: () => fetchPage(address, cursor, fetchOps),
    enabled: !!address,
    staleTime: 10000,
    // Back off immediately when throttled instead of piling on more requests.
    retry: (failureCount, err) => !isRateLimitError(err) && failureCount < 2,
  });

  const goNext = useCallback(() => {
    if (data?.nextCursor) {
      setCursorStack((prev) => [...prev, data.nextCursor!]);
      setPage((prev) => prev + 1);
    }
  }, [data?.nextCursor]);

  const goPrev = useCallback(() => {
    if (page > 0) {
      setPage((prev) => prev - 1);
    }
  }, [page]);

  return {
    transactions: data?.items ?? [],
    isLoading,
    error: error as Error | null,
    hasNext: !!data?.nextCursor,
    hasPrev: page > 0,
    goNext,
    goPrev,
    page: page + 1,
    refetch,
  };
}
