import { useQuery } from "@tanstack/react-query";
import { getRecentEvents } from "@/lib/api";

interface UseRecentEventsOptions {
  /** Polling interval in milliseconds. When set, the query refetches on this cadence. */
  refetchInterval?: number;
  /**
   * Stellar account to scope the feed to, usually the connected wallet's
   * address. The indexer filters on its side, so paging and limits still behave
   * (issue #1115). Leave unset for protocol-wide events.
   */
  issuer?: string;
  /**
   * If false, the query will not be executed. Useful for disabling the query
   * when the wallet is not connected.
   */
  enabled?: boolean;
}

export function useRecentEvents(
  limit?: number,
  options?: UseRecentEventsOptions,
) {
  const issuer = options?.issuer;
  const eventsQuery = useQuery({
    queryKey: ["recentEvents", limit, issuer],
    queryFn: () => getRecentEvents(limit, issuer),
    refetchInterval: options?.refetchInterval,
    enabled: options?.enabled ?? true,
  });

  return {
    events: eventsQuery.data || [],
    isLoading: eventsQuery.isLoading,
    error: eventsQuery.error,
    refetch: eventsQuery.refetch,
  };
}
