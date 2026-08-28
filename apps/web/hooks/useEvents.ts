import { useQuery } from "@tanstack/react-query";
import { getRecentEvents } from "@/lib/api";

interface UseRecentEventsOptions {
  /** Polling interval in milliseconds. When set, the query refetches on this cadence. */
  refetchInterval?: number;
}

/**
 * Custom hook for fetching recent platform events from the indexer API.
 *
 * Wraps React Query to provide automatic caching and optional polling.
 *
 * @param limit - Maximum number of events to return. Defaults to the API's
 *   own limit when omitted.
 * @param options - Optional configuration.
 * @param options.refetchInterval - Polling interval in milliseconds. When set,
 *   the query refetches on this cadence.
 *
 * @returns An object containing:
 *   - `events` — Array of event objects (defaults to `[]` while loading).
 *   - `isLoading` — `true` while the events query is in flight.
 *   - `error` — Fetch error, or `null` if none.
 *   - `refetch` — Function to manually re-trigger the events query.
 *
 * @example
 * const { events, isLoading, error } = useRecentEvents(20, {
 *   refetchInterval: 60_000,
 * });
 */
export function useRecentEvents(
  limit?: number,
  options?: UseRecentEventsOptions,
) {
  const eventsQuery = useQuery({
    queryKey: ["recentEvents", limit],
    queryFn: () => getRecentEvents(limit),
    refetchInterval: options?.refetchInterval,
  });

  return {
    events: eventsQuery.data || [],
    isLoading: eventsQuery.isLoading,
    error: eventsQuery.error,
    refetch: eventsQuery.refetch,
  };
}
