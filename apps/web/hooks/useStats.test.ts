import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useStats } from "./useStats";
import { useQuery } from "@tanstack/react-query";
import { getProtocolStats, ProtocolStats } from "@/lib/api";

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  getProtocolStats: vi.fn(),
}));

const mockStats: ProtocolStats = {
  total_usdc_financed: "1000000",
  active_invoice_count: 5,
  total_invoices: 42,
  total_repaid: 30,
  total_defaulted: 2,
  average_yield_bps: 850,
  pool_utilization_bps: 6500,
  registered_issuers: 12,
};

describe("useStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns stats on default/successful render", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: mockStats,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    const { result } = renderHook(() => useStats());

    expect(result.current.stats).toEqual(mockStats);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("shows loading state while stats are being fetched", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    } as any);

    const { result } = renderHook(() => useStats());

    expect(result.current.stats).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
  });

  it("surfaces an error state when the fetch fails", () => {
    const fetchError = new Error("Stats fetch failed");
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: fetchError,
      refetch: vi.fn(),
    } as any);

    const { result } = renderHook(() => useStats());

    expect(result.current.error).toEqual(fetchError);
    expect(result.current.stats).toBeUndefined();
  });

  it("exposes a refetch function that re-triggers the query", () => {
    const mockRefetch = vi.fn();
    vi.mocked(useQuery).mockReturnValue({
      data: mockStats,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    } as any);

    const { result } = renderHook(() => useStats());
    result.current.refetch();

    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("configures the query with the expected key, fetcher, and caching options", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: mockStats,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    renderHook(() => useStats());

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["protocolStats"],
        refetchInterval: 60000,
        staleTime: 30000,
        retry: 3,
      }),
    );

    const call = vi.mocked(useQuery).mock.calls[0][0] as any;
    call.queryFn();
    expect(getProtocolStats).toHaveBeenCalledTimes(1);
  });
});
