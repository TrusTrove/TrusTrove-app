"use client";

import { useQuery } from "@tanstack/react-query";
import { Horizon } from "@stellar/stellar-sdk";
import { useState, useCallback } from "react";
import type { TxHistoryItem } from "@/types";

const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL || "https://horizon-testnet.stellar.org";

const CONTRACT_IDS = [
  process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID,
  process.env.NEXT_PUBLIC_INVOICE_CONTRACT_ID,
  process.env.NEXT_PUBLIC_POOL_CONTRACT_ID,
  process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID,
].filter(Boolean) as string[];

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

function getTxType(funcName: string): string {
  return FUNCTION_LABELS[funcName] || "Contract Invocation";
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

async function fetchPage(address: string, cursor?: string) {
  const server = new Horizon.Server(HORIZON_URL);

  let txQuery = server
    .transactions()
    .forAccount(address)
    .limit(10)
    .order("desc");

  if (cursor) {
    txQuery = txQuery.cursor(cursor);
  }

  const txPage = await txQuery.call();

  if (txPage.records.length === 0) {
    return { items: [], nextCursor: null };
  }

  const opsResults = await Promise.allSettled(
    txPage.records.map((tx) =>
      server.operations().forTransaction(tx.hash).limit(200).call(),
    ),
  );

  const items: TxHistoryItem[] = [];

  for (let i = 0; i < txPage.records.length; i++) {
    const tx = txPage.records[i];
    const opsResult = opsResults[i];

    if (opsResult.status === "rejected") continue;

    const ops = opsResult.value.records;
    const matchingOps = ops.filter(
      (op: any) => op.contract_id && CONTRACT_IDS.includes(op.contract_id),
    );

    if (matchingOps.length === 0) continue;

    const mainOp = matchingOps[0] as any;
    const type = getTxType(mainOp.function);

    items.push({
      id: tx.hash,
      type,
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
 * Custom hook for paginated transaction history from the Stellar Horizon API.
 *
 * Fetches transactions for the given address, filtering to only those that
 * invoke TrusTrove smart contracts (registry, invoice, pool, escrow).
 * Supports cursor-based forward/backward pagination with 10 items per page.
 *
 * @param address - The Stellar public key to fetch transaction history for.
 *   The query is disabled (skipped) when the address is an empty string.
 *
 * @returns An object containing:
 *   - `transactions` — Array of `TxHistoryItem` for the current page (defaults to `[]`).
 *   - `isLoading` — `true` while transactions are being fetched.
 *   - `error` — Fetch error, or `null` if none.
 *   - `hasNext` — `true` if there are more pages forward.
 *   - `hasPrev` — `true` if there are pages before the current one.
 *   - `goNext` — Advances to the next page of results.
 *   - `goPrev` — Returns to the previous page of results.
 *   - `page` — Current 1-based page number.
 *   - `refetch` — Function to manually re-trigger the query.
 *
 * @example
 * const { transactions, isLoading, hasNext, goNext, goPrev } =
 *   useTxHistory(walletAddress);
 */
export function useTxHistory(address: string): TxHistoryResult {
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([
    undefined,
  ]);
  const [page, setPage] = useState(0);
  const cursor = cursorStack[page];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["txHistory", address, cursor],
    queryFn: () => fetchPage(address, cursor),
    enabled: !!address,
    staleTime: 10000,
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
