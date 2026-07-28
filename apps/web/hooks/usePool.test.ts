import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { usePool } from "./usePool";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PoolClient } from "@trusttrove/sdk";
import { useWalletStore } from "@/store/wallet";
import * as toast from "@/lib/toast";

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(),
}));

vi.mock("@trusttrove/sdk", () => ({
  PoolClient: vi.fn(function () {}),
}));

vi.mock("@/lib/toast", () => ({
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
}));

vi.mock("./useTokenAllowance", () => ({
  useTokenAllowance: () => ({
    ensureAllowance: vi.fn().mockResolvedValue(undefined),
  }),
}));

function makeQueryResult(overrides: Record<string, any> = {}): any {
  return {
    data: null,
    dataUpdatedAt: 0,
    error: null,
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    errorUpdateCount: 0,
    fetchStatus: "idle",
    isFetched: false,
    isFetchedAfterMount: false,
    isFetching: false,
    isInitialLoading: false,
    isLoading: false,
    isError: false,
    isEnabled: true,
    isRefetching: false,
    isPending: false,
    isLoadingError: false,
    isRefetchError: false,
    isPlaceholderData: false,
    isPaused: false,
    isStale: false,
    isSuccess: false,
    promise: Promise.resolve(),
    refetch: vi.fn(),
    status: "pending",
    ...overrides,
  };
}

function mockMutation() {
  vi.mocked(useMutation).mockImplementation(
    (options: any) =>
      ({
        mutateAsync: async (args: any) => {
          try {
            const res = await options.mutationFn(args);
            options.onSuccess?.(res);
            return res;
          } catch (e) {
            options.onError?.(e);
            throw e;
          }
        },
        isPending: false,
        error: null,
      }) as any,
  );
}

describe("usePool", () => {
  let mockInvalidateQueries: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    useWalletStore.getState().disconnect();

    mockInvalidateQueries = vi.fn();
    vi.mocked(useQueryClient).mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    } as any);

    vi.mocked(useQuery).mockReturnValue(makeQueryResult());

    mockMutation();
  });

  it("returns stats from query", () => {
    vi.mocked(useQuery).mockReturnValue(
      makeQueryResult({
        data: { totalDeposits: 1000n, utilizationRateBps: 500 },
      }),
    );

    const { result } = renderHook(() => usePool());
    expect(result.current.stats).toEqual({
      totalDeposits: 1000n,
      utilizationRateBps: 500,
    });
    expect(result.current.isStatsLoading).toBe(false);
    expect(result.current.statsError).toBeNull();
  });

  it("shows stats loading state", () => {
    vi.mocked(useQuery).mockReturnValue(
      makeQueryResult({
        data: undefined,
        isLoading: true,
      }),
    );

    const { result } = renderHook(() => usePool());
    expect(result.current.isStatsLoading).toBe(true);
  });

  it("shows stats error state", () => {
    vi.mocked(useQuery).mockReturnValue(
      makeQueryResult({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error("Stats fetch failed"),
      }),
    );

    const { result } = renderHook(() => usePool());
    expect(result.current.statsError).toEqual(new Error("Stats fetch failed"));
  });

  it("returns position when wallet is connected", () => {
    vi.mocked(useQuery).mockImplementation(function (args: any): any {
      const qk = args.queryKey;
      if (qk[0] === "poolStats") {
        return makeQueryResult();
      }
      if (qk[0] === "lpPosition") {
        return makeQueryResult({ data: { shares: 500n, usdcValue: 1000n } });
      }
      return makeQueryResult();
    });

    act(() => {
      useWalletStore.getState().connect("G123", "testnet");
    });

    const { result } = renderHook(() => usePool());
    expect(result.current.position).toEqual({ shares: 500n, usdcValue: 1000n });
    expect(result.current.isPositionLoading).toBe(false);
  });

  it("position query is disabled without wallet", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    renderHook(() => usePool());
    const calls = vi.mocked(useQuery).mock.calls;
    const positionCall = calls.find(
      (c: unknown) => (c as any)[0]?.queryKey?.[0] === "lpPosition",
    );
    expect((positionCall?.[0] as any)?.enabled).toBe(false);
  });

  it("deposit works", async () => {
    act(() => {
      useWalletStore.getState().connect("G123", "testnet");
    });

    const mockDeposit = vi.fn().mockResolvedValue("tx_hash_123");
    vi.mocked(PoolClient).mockImplementation(function () {
      return { deposit: mockDeposit };
    } as any);

    const { result } = renderHook(() => usePool());

    await act(async () => {
      await result.current.deposit({ amount: 100n });
    });

    expect(mockDeposit).toHaveBeenCalledWith("G123", 100n, "USDC", "G123");
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["poolStats"],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["lpPosition", "G123"],
    });
    expect(toast.showSuccessToast).toHaveBeenCalledWith(
      "Deposit Complete",
      "tx_hash_123",
    );
  });

  it("deposit fails if no wallet", async () => {
    const { result } = renderHook(() => usePool());

    await expect(
      act(async () => {
        await result.current.deposit({ amount: 100n });
      }),
    ).rejects.toThrow("Wallet not connected");

    expect(toast.showErrorToast).toHaveBeenCalled();
  });

  it("deposit handles SDK failure", async () => {
    act(() => {
      useWalletStore.getState().connect("G123", "testnet");
    });

    vi.mocked(PoolClient).mockImplementation(function () {
      return { deposit: vi.fn().mockRejectedValue(new Error("Pool full")) };
    } as any);

    const { result } = renderHook(() => usePool());

    await expect(
      act(async () => {
        await result.current.deposit({ amount: 100n });
      }),
    ).rejects.toThrow("Pool full");

    expect(toast.showErrorToast).toHaveBeenCalled();
  });

  it("withdraw works", async () => {
    act(() => {
      useWalletStore.getState().connect("G123", "testnet");
    });

    const mockWithdraw = vi.fn().mockResolvedValue("tx_hash_456");
    vi.mocked(PoolClient).mockImplementation(function () {
      return { withdraw: mockWithdraw };
    } as any);

    const { result } = renderHook(() => usePool());

    await act(async () => {
      await result.current.withdraw({ shares: 50n });
    });

    expect(mockWithdraw).toHaveBeenCalledWith("G123", 50n, "G123");
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["poolStats"],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["lpPosition", "G123"],
    });
    expect(toast.showSuccessToast).toHaveBeenCalledWith(
      "Withdrawal Complete",
      "tx_hash_456",
    );
  });

  it("withdraw fails if no wallet", async () => {
    const { result } = renderHook(() => usePool());

    await expect(
      act(async () => {
        await result.current.withdraw({ shares: 50n });
      }),
    ).rejects.toThrow("Wallet not connected");

    expect(toast.showErrorToast).toHaveBeenCalled();
  });

  it("withdraw handles SDK failure", async () => {
    act(() => {
      useWalletStore.getState().connect("G123", "testnet");
    });

    vi.mocked(PoolClient).mockImplementation(function () {
      return {
        withdraw: vi.fn().mockRejectedValue(new Error("Insufficient shares")),
      };
    } as any);

    const { result } = renderHook(() => usePool());

    await expect(
      act(async () => {
        await result.current.withdraw({ shares: 50n });
      }),
    ).rejects.toThrow("Insufficient shares");

    expect(toast.showErrorToast).toHaveBeenCalled();
  });
});
