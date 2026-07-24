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
    expect(result.current.error).toBeNull();
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
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("connectWallet shows loading during connection", async () => {
    let resolveConnect: (v: string) => void;
    vi.mocked(connectFreighter).mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveConnect = resolve;
        }),
    );

    const { result } = renderHook(() => useWallet());

    let promise: Promise<void>;
    act(() => {
      promise = result.current.connectWallet();
    });
    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolveConnect!("G12345");
      await promise!;
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.connected).toBe(true);
  });

  it("connectWallet fails with Error", async () => {
    vi.mocked(connectFreighter).mockRejectedValue(
      new Error("Freighter wallet is not installed"),
    );

    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await result.current.connectWallet();
    });

    expect(result.current.error).toBe("Freighter wallet is not installed");
    expect(result.current.connected).toBe(false);
    expect(result.current.address).toBeNull();
  });

  it("connectWallet fails with non-Error rejection", async () => {
    vi.mocked(connectFreighter).mockRejectedValue("User rejected request");

    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await result.current.connectWallet();
    });

    expect(result.current.error).toBe("User rejected request");
    expect(result.current.connected).toBe(false);
  });

  it("clears previous error on retry", async () => {
    vi.mocked(connectFreighter).mockRejectedValueOnce(
      new Error("First failure"),
    );

    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await result.current.connectWallet();
    });
    expect(result.current.error).toBe("First failure");

    vi.mocked(connectFreighter).mockResolvedValueOnce("G12345");

    await act(async () => {
      await result.current.connectWallet();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.connected).toBe(true);
  });

  it("handles Freighter unavailable", async () => {
    vi.mocked(connectFreighter).mockRejectedValue(
      new Error("Freighter wallet is not installed"),
    );

    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await result.current.connectWallet();
    });

    expect(result.current.error).toBe("Freighter wallet is not installed");
    expect(result.current.connected).toBe(false);
    expect(result.current.address).toBeNull();
  });

  it("disconnectWallet works", () => {
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
    expect(result.current.error).toBeNull();
  });

  it("exposes balances from useBalances", () => {
    vi.mocked(useBalances).mockReturnValue({
      balances: { usdc: "100", xlm: "50" },
      loading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    const { result } = renderHook(() => useWallet());
    expect(result.current.balances).toEqual({ usdc: "100", xlm: "50" });
    expect(result.current.balancesLoading).toBe(false);
    expect(result.current.balancesError).toBeNull();
  });
});
