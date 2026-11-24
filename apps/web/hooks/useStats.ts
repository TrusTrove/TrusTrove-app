import { useQuery } from "@tanstack/react-query";
import { getProtocolStats, ProtocolStats } from "@/lib/api";
import { retryTransientQuery, transientRetryDelayMs } from "@/lib/retry";

/**
 * Custom hook for fetching protocol statistics from the indexer.
 *
 * Provides protocol-wide statistics including registered issuers, total invoices,
 * and other metrics. All data is fetched from the /stats endpoint with caching
 * and automatic refetching.
 *
 * @returns An object containing:
 *   - `stats` — Protocol statistics, or `undefined` while loading.
 *   - `isLoading` — `true` while stats are being fetched.
 *   - `error` — Fetch error, or `null` if none.
 *   - `refetch` — Function to manually re-trigger the stats query.
 *
 * @example
 * const { stats, isLoading, error } = useStats();
 */
export function useStats() {
  const query = useQuery({
    queryKey: ["protocolStats"],
    queryFn: ({ signal }) => getProtocolStats({ signal }),
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000, // Consider data fresh for 30 seconds
    // Bounded, transient-only retry (issue #639): the previous blind
    // `retry: 3` also retried permanent 4xx responses.
    retry: retryTransientQuery,
    retryDelay: (failureCount: number) => transientRetryDelayMs(failureCount),
  });

  return {
    stats: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
