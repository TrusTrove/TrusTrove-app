import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useBalances } from "./useBalances";
import { useWalletStore } from "@/store/wallet";
import { Horizon } from "@stellar/stellar-sdk";
import { ASSET_INFO } from "@/lib/assets";

vi.mock("@stellar/stellar-sdk", () => ({
  Horizon: {
    Server: vi.fn(function () {}),
  },
}));

describe("useBalances", () => {
  let mockLoadAccount: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    useWalletStore.getState().disconnect();
    vi.useFakeTimers();

    mockLoadAccount = vi.fn();
    vi.mocked(Horizon.Server).mockImplementation(function () {
      return {
        loadAccount: mockLoadAccount,
      };
    } as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns nulls if not connected", () => {
    const { result } = renderHook(() => useBalances());
    expect(result.current.balances).toEqual({ usdc: null, xlm: null });
    expect(result.current.loading).toBe(false);
  });

  it("fetches balances on connect", async () => {
    mockLoadAccount.mockResolvedValue({
      balances: [
        { asset_type: "native", balance: "100.00" },
        {
          asset_type: "credit_alphanum4",
          asset_code: "USDC",
          asset_issuer: ASSET_INFO.USDC.issuer,
          balance: "50.00",
        },
      ],
    });

    act(() => {
      useWalletStore.getState().connect("G123", "testnet");
    });

    const { result } = renderHook(() => useBalances());

    expect(result.current.loading).toBe(true);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockLoadAccount).toHaveBeenCalledWith("G123");
    expect(result.current.balances).toEqual({ xlm: "100.00", usdc: "50.00" });
    expect(result.current.loading).toBe(false);
  });

  it("handles 404 error (unfunded account)", async () => {
    const error = new Error("Not found") as any;
    error.response = { status: 404 };
    mockLoadAccount.mockRejectedValue(error);

    act(() => {
      useWalletStore.getState().connect("G123", "testnet");
    });

    const { result } = renderHook(() => useBalances());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.balances).toEqual({ usdc: null, xlm: "0" });
    expect(result.current.error).toBeNull();
  });

  it("handles generic error", async () => {
    mockLoadAccount.mockRejectedValue(new Error("Network error"));

    act(() => {
      useWalletStore.getState().connect("G123", "testnet");
    });

    const { result } = renderHook(() => useBalances());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.error).toBe("Failed to fetch balances");
  });

  it("handles interval refetching", async () => {
    mockLoadAccount.mockResolvedValue({
      balances: [{ asset_type: "native", balance: "10.00" }],
    });

    act(() => {
      useWalletStore.getState().connect("G123", "testnet");
    });

    renderHook(() => useBalances());

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockLoadAccount).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    expect(mockLoadAccount).toHaveBeenCalledTimes(2);
  });
});
