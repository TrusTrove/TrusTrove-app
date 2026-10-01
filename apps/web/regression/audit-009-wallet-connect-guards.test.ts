import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getNetworkDetails } from "@stellar/freighter-api";
import { useWallet } from "@/hooks/useWallet";
import { useWalletStore } from "@/store/wallet";
import { connectFreighter } from "@/lib/freighter";
import { useBalances } from "@/hooks/useBalances";

// Regression lock-in for two closed bug fixes in apps/web/hooks/useWallet.ts:
//   #641 / PR #695 - validateFreighterNetwork() must reject connections when
//                    Freighter reports a network other than testnet
//                    (error code "wrong_network", then disconnect()).
//   #640 / PR #694 - connectingRef must make connectWallet() ignore overlapping
//                    calls and clear the guard afterwards.
// Reverting either fix should turn these cases red.

vi.mock("@/lib/freighter", () => ({
  connectFreighter: vi.fn(),
  FreighterError: class FreighterError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = "FreighterError";
      this.code = code;
    }
  },
}));

vi.mock("@stellar/freighter-api", () => ({
  getNetworkDetails: vi.fn(),
}));

vi.mock("@/hooks/useBalances", () => ({
  useBalances: vi.fn(),
}));

const EXPECTED_NETWORK = "testnet";
const WRONG_NETWORK_ERROR_CODE = "wrong_network";
const WRONG_NETWORK_ERROR_MESSAGE =
  "Your Freighter wallet is connected to the wrong network. Please switch Freighter to Stellar Testnet and try again.";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("Regression: useWallet connection guards (#894)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWalletStore.getState().disconnect();
    vi.mocked(getNetworkDetails).mockResolvedValue({
      network: EXPECTED_NETWORK,
    } as any);
    vi.mocked(useBalances).mockReturnValue({
      balances: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    } as any);
  });

  it("rejects a connection when Freighter reports a non-testnet network", async () => {
    vi.mocked(connectFreighter).mockResolvedValue("G12345");
    vi.mocked(getNetworkDetails).mockResolvedValue({
      network: "PUBLIC",
    } as any);

    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await result.current.connectWallet();
    });

    expect(connectFreighter).toHaveBeenCalledTimes(1);
    expect(getNetworkDetails).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBe(WRONG_NETWORK_ERROR_MESSAGE);
    expect(result.current.errorCode).toBe(WRONG_NETWORK_ERROR_CODE);
    expect(result.current.connected).toBe(false);
    expect(result.current.address).toBeNull();
    // The wrongly-connected wallet must not be stored as connected.
    expect(useWalletStore.getState().connected).toBe(false);
    expect(useWalletStore.getState().address).toBeNull();
  });

  it('accepts a network string with casing and whitespace (" TestNet ")', async () => {
    vi.mocked(connectFreighter).mockResolvedValue("G12345");
    vi.mocked(getNetworkDetails).mockResolvedValue({
      network: " TestNet ",
    } as any);

    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await result.current.connectWallet();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.errorCode).toBeNull();
    expect(result.current.connected).toBe(true);
    expect(result.current.address).toBe("G12345");
    expect(result.current.network).toBe(EXPECTED_NETWORK);
  });

  it("rejects when Freighter returns an empty network object", async () => {
    vi.mocked(connectFreighter).mockResolvedValue("G12345");
    vi.mocked(getNetworkDetails).mockResolvedValue({} as any);

    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await result.current.connectWallet();
    });

    expect(result.current.error).toBe(WRONG_NETWORK_ERROR_MESSAGE);
    expect(result.current.errorCode).toBe(WRONG_NETWORK_ERROR_CODE);
    expect(result.current.connected).toBe(false);
    expect(useWalletStore.getState().connected).toBe(false);
  });

  it("does not silently accept an undefined network value", async () => {
    vi.mocked(connectFreighter).mockResolvedValue("G12345");
    vi.mocked(getNetworkDetails).mockResolvedValue({
      network: undefined,
    } as any);

    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await result.current.connectWallet();
    });

    expect(result.current.errorCode).toBe(WRONG_NETWORK_ERROR_CODE);
    expect(result.current.connected).toBe(false);
  });

  it("ignores overlapping connectWallet calls and clears the guard afterwards", async () => {
    const first = deferred<string>();
    vi.mocked(connectFreighter).mockReturnValueOnce(first.promise);

    const { result } = renderHook(() => useWallet());

    let firstCall!: Promise<void>;
    let secondCall!: Promise<void>;

    // Fire two attempts before the first one resolves.
    act(() => {
      firstCall = result.current.connectWallet();
      secondCall = result.current.connectWallet();
    });

    expect(connectFreighter).toHaveBeenCalledTimes(1);

    await act(async () => {
      first.resolve("G12345");
      await Promise.all([firstCall, secondCall]);
    });

    expect(connectFreighter).toHaveBeenCalledTimes(1);
    expect(result.current.connected).toBe(true);

    // The guard must be released, so a later retry connects for real.
    vi.mocked(connectFreighter).mockResolvedValueOnce("G99999");

    await act(async () => {
      await result.current.connectWallet();
    });

    expect(connectFreighter).toHaveBeenCalledTimes(2);
    expect(result.current.address).toBe("G99999");
    expect(result.current.connected).toBe(true);
  });
});
