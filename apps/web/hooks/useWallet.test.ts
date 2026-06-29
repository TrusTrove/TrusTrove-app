import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useWallet } from "./useWallet";
import { useWalletStore } from "@/store/wallet";
import { connectFreighter } from "@/lib/freighter";
import { useBalances } from "./useBalances";

vi.mock("@/lib/freighter", () => ({
  connectFreighter: vi.fn(),
}));

vi.mock("./useBalances", () => ({
  useBalances: vi.fn(),
}));

describe("useWallet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWalletStore.getState().disconnect();
    vi.mocked(useBalances).mockReturnValue({
      balances: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    } as any);
  });

  it("initial state", () => {
    const { result } = renderHook(() => useWallet());
    expect(result.current.connected).toBe(false);
    expect(result.current.address).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("connectWallet succeeds", async () => {
    vi.mocked(connectFreighter).mockResolvedValue("G12345");

    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await result.current.connectWallet();
    });

    expect(connectFreighter).toHaveBeenCalled();
    expect(result.current.connected).toBe(true);
    expect(result.current.address).toBe("G12345");
    expect(result.current.network).toBe("testnet");
  });

  it("connectWallet fails", async () => {
    vi.mocked(connectFreighter).mockRejectedValue(
      new Error("Freighter not installed"),
    );

    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await result.current.connectWallet();
    });

    expect(result.current.error).toBe("Freighter not installed");
    expect(result.current.connected).toBe(false);
  });

  it("disconnectWallet works", async () => {
    act(() => {
      useWalletStore.getState().connect("G123", "testnet");
    });

    const { result } = renderHook(() => useWallet());
    expect(result.current.connected).toBe(true);

    act(() => {
      result.current.disconnectWallet();
    });

    expect(result.current.connected).toBe(false);
    expect(result.current.address).toBeNull();
  });
});
