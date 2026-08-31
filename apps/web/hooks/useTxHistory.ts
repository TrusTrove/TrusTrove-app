"use client";

import { useQuery } from "@tanstack/react-query";
import { Horizon } from "@stellar/stellar-sdk";
import { useState, useCallback, useEffect } from "react";
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

    const ops = opsResult.value.records as HorizonOperationRecord[];
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

  useEffect(() => {
    setCursorStack([undefined]);
    setPage(0);
  }, [address]);

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
