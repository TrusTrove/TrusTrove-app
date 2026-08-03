import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { usePoolChartData } from './usePoolChartData';
import type { PoolChartData } from './usePoolChartData';

// Import the real module so vitest can hoist the mock
import { getPoolStats } from '@/lib/api';

vi.mock('@/lib/api');

const mockGetPoolStats = vi.mocked(getPoolStats);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

function makeStats(overrides: Record<string, unknown> = {}) {
  return {
    totalDeposits: 1_000_000n,
    totalFunded: 500_000n,
    availableLiquidity: 600_000n,
    utilizationRateBps: 4000,
    totalYieldDistributed: 50_000n,
    activeInvoiceCount: 12,
    ...overrides,
  };
}

describe('usePoolChartData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Happy path – the hook fetches stats and formats them into two chart series.
   */
  it('returns formatted chart data on successful fetch', async () => {
    mockGetPoolStats.mockResolvedValueOnce(makeStats());

    const { result } = renderHook(() => usePoolChartData(), {
      wrapper: createWrapper(),
    });

    // Initially loading, no data
    expect(result.current.isLoading).toBe(true);
    expect(result.current.chartData).toBeNull();
    expect(result.current.error).toBeNull();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const chartData = result.current.chartData as PoolChartData;
    expect(chartData).not.toBeNull();

    // Overview series
    expect(chartData.overview).toHaveLength(2);
    expect(chartData.overview[0]).toEqual({ label: 'Total Deposits', value: 1_000_000 });
    expect(chartData.overview[1]).toEqual({ label: 'Total Funded', value: 500_000 });

    // Liquidity series
    expect(chartData.liquidity).toHaveLength(2);
    expect(chartData.liquidity[0]).toEqual({ label: 'Available', value: 600_000 });
    expect(chartData.liquidity[1]).toEqual({ label: 'Utilised', value: 400_000 });

    expect(result.current.error).toBeNull();
  });

  /**
   * Edge case – all stats are zero (brand-new pool with no activity).
   * The hook should still produce a valid data shape without crashing.
   */
  it('handles zero / empty pool stats gracefully', async () => {
    mockGetPoolStats.mockResolvedValueOnce(
      makeStats({
        totalDeposits: 0n,
        totalFunded: 0n,
        availableLiquidity: 0n,
      })
    );

    const { result } = renderHook(() => usePoolChartData(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const chartData = result.current.chartData as PoolChartData;
    expect(chartData).not.toBeNull();

    // All values should be zero but still present
    for (const point of chartData.overview) {
      expect(point.value).toBe(0);
    }
    for (const point of chartData.liquidity) {
      expect(point.value).toBe(0);
    }
    expect(result.current.error).toBeNull();
  });

  /**
   * Error path – the API call fails. The hook should surface the error
   * and leave `chartData` as null.
   */
  it('exposes the error when the API call fails', async () => {
    const apiError = new Error('Network timeout');
    mockGetPoolStats.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => usePoolChartData(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.chartData).toBeNull();
    expect(result.current.error).toEqual(apiError);
  });
});
