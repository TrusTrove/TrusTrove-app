import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAuth } from "./useAuth";
import { useWalletStore } from "@/store/wallet";
import { signTransaction } from "@stellar/freighter-api";
import { fetchChallenge, verifyChallenge } from "@/lib/api";

vi.mock("@stellar/freighter-api", () => ({
  signTransaction: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  fetchChallenge: vi.fn(),
  verifyChallenge: vi.fn(),
}));

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const store = useWalletStore.getState();
    store.disconnect();
  });

  it("initial state is unauthenticated", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.token).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("login fails if wallet not connected", async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.login();
    });
    expect(result.current.error).toBe("Wallet not connected");
  });

  it("successful login flow", async () => {
    act(() => {
      useWalletStore.getState().connect("G123", "TESTNET");
    });

    vi.mocked(fetchChallenge).mockResolvedValue({
      transaction: "xdr_data",
      network_passphrase: "Test SDF Network ; September 2015",
    });
    vi.mocked(signTransaction).mockResolvedValue("signed_xdr");
    vi.mocked(verifyChallenge).mockResolvedValue({ token: "jwt_token" });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login();
    });

    expect(fetchChallenge).toHaveBeenCalledWith("G123");
    expect(signTransaction).toHaveBeenCalledWith(
      "xdr_data",
      expect.any(Object),
    );
    expect(verifyChallenge).toHaveBeenCalledWith("signed_xdr");

    expect(result.current.token).toBe("jwt_token");
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("handles login fetch failure", async () => {
    act(() => {
      useWalletStore.getState().connect("G123", "TESTNET");
    });
    vi.mocked(fetchChallenge).mockRejectedValue(new Error("Fetch failed"));

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login();
    });

    expect(result.current.error).toBe("Fetch failed");
    expect(result.current.token).toBeNull();
  });

  it("logout clears token and disconnects", () => {
    act(() => {
      useWalletStore.getState().connect("G123", "TESTNET");
      useWalletStore.getState().setToken("jwt_token");
    });

    const { result } = renderHook(() => useAuth());
    expect(result.current.isAuthenticated).toBe(true);

    act(() => {
      result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(useWalletStore.getState().address).toBeNull();
  });
});
