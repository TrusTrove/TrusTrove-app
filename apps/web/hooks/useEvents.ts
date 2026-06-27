import { useQuery } from '@tanstack/react-query';
import { getRecentEvents } from '@/lib/api';

interface UseRecentEventsOptions {
  /** Polling interval in milliseconds. When set, the query refetches on this cadence. */
  refetchInterval?: number;
}

export function useRecentEvents(limit?: number, options?: UseRecentEventsOptions) {
  const eventsQuery = useQuery({
    queryKey: ['recentEvents', limit],
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
