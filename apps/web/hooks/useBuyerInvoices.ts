import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAllInvoices } from "@/lib/api";
import {
  countActionableInvoices,
  filterBuyerInvoices,
  groupBuyerInvoices,
  isValidBuyerAddress,
} from "@/lib/buyerWorkspace";

/**
 * Loads the invoices addressed to the connected buyer and groups them by the
 * next action required.
 *
 * The indexer API can filter by issuer but not by buyer, so the query walks
 * the invoice set with {@link getAllInvoices} and the grouping helper isolates
 * this buyer's rows. The query stays disabled for a missing or malformed
 * address, which keeps the authorization boundary on the client as well.
 *
 * @param buyer - The connected wallet address, or `null` when disconnected.
 * @returns An object containing:
 *   - `groups` — non-empty next-action buckets, in work order.
 *   - `invoices` — this buyer's invoices, flattened from `groups`.
 *   - `actionableCount` — invoices that need the buyer to do something.
 *   - `isLoading` — `true` while the first fetch is in flight.
 *   - `error` — Fetch error, or `null` if none.
 *   - `refetch` — Re-runs the query.
 */
export function useBuyerInvoices(buyer?: string | null) {
  const enabled = isValidBuyerAddress(buyer);

  const invoicesQuery = useQuery({
    queryKey: ["buyerInvoices", buyer],
    queryFn: () => getAllInvoices(),
    enabled,
    refetchInterval: 15000,
    staleTime: 15000,
  });

  const groups = useMemo(
    () => groupBuyerInvoices(invoicesQuery.data ?? [], buyer),
    [invoicesQuery.data, buyer],
  );

  return {
    groups,
    invoices: useMemo(
      () => filterBuyerInvoices(invoicesQuery.data ?? [], buyer),
      [invoicesQuery.data, buyer],
    ),
    actionableCount: countActionableInvoices(groups),
    isLoading: enabled && invoicesQuery.isLoading,
    error: invoicesQuery.error,
    refetch: invoicesQuery.refetch,
  };
}
