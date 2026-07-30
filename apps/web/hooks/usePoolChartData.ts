import { useQuery } from '@tanstack/react-query';
import { getPoolStats } from '@/lib/api';

/** A single data point for a chart series. */
export interface PoolChartDataPoint {
  label: string;
  value: number;
}

/** Chart-ready pool statistics broken into display series. */
export interface PoolChartData {
  /** Deposit & funding overview (total deposits, total funded). */
  overview: PoolChartDataPoint[];
  /** Liquidity breakdown (available vs utilised). */
  liquidity: PoolChartDataPoint[];
}

/**
 * Fetches on-chain pool statistics and transforms them into chart-friendly
 * data series suitable for bar / pie / line charts.
 *
 * Uses `@tanstack/react-query` under the hood, caching responses under the
 * `['poolStats']` query key.
 *
 * @returns An object with:
 *   - `chartData` — formatted {@link PoolChartData}, or `null` while loading / on error.
 *   - `isLoading` — `true` while the underlying fetch is in-flight.
 *   - `error` — the fetch error if one occurred, otherwise `null`.
 *   - `refetch` — manually trigger a re-fetch of pool statistics.
 *
 * @example
 * const { chartData, isLoading, error } = usePoolChartData();
 * // Pass `chartData.overview` and `chartData.liquidity` to your chart component.
 */
export function usePoolChartData() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['poolStats'],
    queryFn: () => getPoolStats(),
  });

  const chartData: PoolChartData | null = data
    ? {
        overview: [
          { label: 'Total Deposits', value: Number(data.totalDeposits) },
          { label: 'Total Funded', value: Number(data.totalFunded) },
        ],
        liquidity: [
          { label: 'Available', value: Number(data.availableLiquidity) },
          {
            label: 'Utilised',
            value: Number(data.totalDeposits - data.availableLiquidity),
          },
        ],
      }
    : null;

  return { chartData, isLoading, error, refetch };
}
