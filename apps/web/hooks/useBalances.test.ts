import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useBalances } from "./useBalances";
import { useQuery } from "@tanstack/react-query";
import { useWalletStore } from "@/store/wallet";

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
}));

describe("useBalances", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWalletStore.getState().disconnect();
  });

  it("returns nulls if not connected", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    const { result } = renderHook(() => useBalances());
    expect(result.current.balances).toEqual({ usdc: null, xlm: null });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(vi.mocked(useQuery)).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false, refetchInterval: 30000 }),
    );
  });

  it("fetches balances on connect", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: { usdc: "50.00", xlm: "100.00" },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    act(() => {
      useWalletStore.getState().connect("G123", "testnet");
    });

    const { result } = renderHook(() => useBalances());
    expect(result.current.balances).toEqual({ usdc: "50.00", xlm: "100.00" });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(vi.mocked(useQuery)).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["balances", "G123"],
        enabled: true,
        refetchInterval: 30000,
      }),
    );
  });

  it("handles 404 error (unfunded account)", () => {
    const error = new Error("Not found") as any;
    error.response = { status: 404 };

    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      error,
      refetch: vi.fn(),
    } as any);

    act(() => {
      useWalletStore.getState().connect("G123", "testnet");
    });

    const { result } = renderHook(() => useBalances());
    expect(result.current.balances).toEqual({ usdc: null, xlm: "0" });
    expect(result.current.error).toBeNull();
  });

  it("handles generic error", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Network error"),
      refetch: vi.fn(),
    } as any);

    act(() => {
      useWalletStore.getState().connect("G123", "testnet");
    });

    const { result } = renderHook(() => useBalances());
    expect(result.current.error).toBe("Failed to fetch balances");
  });

  it("uses refetchInterval with background polling disabled", () => {
    act(() => {
      useWalletStore.getState().connect("G123", "testnet");
    });

    renderHook(() => useBalances());
    const options = vi.mocked(useQuery).mock.calls[0][0];
    expect(options.refetchInterval).toBe(30000);
    expect(options.refetchIntervalInBackground).toBeUndefined();
  });
});
