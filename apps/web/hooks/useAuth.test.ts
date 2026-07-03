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
    expect(result.current.loading).toBe(false);
  });

  it("sets loading state during login", async () => {
    let resolveChallenge: (v: any) => void;
    vi.mocked(fetchChallenge).mockImplementation(
      () => new Promise((resolve) => { resolveChallenge = resolve; }),
    );

    act(() => {
      useWalletStore.getState().connect("G123", "TESTNET");
    });

    const { result } = renderHook(() => useAuth());

    let promise: Promise<void>;
    act(() => {
      promise = result.current.login();
    });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolveChallenge!({
        transaction: "xdr_data",
        network_passphrase: "Test SDF Network ; September 2015",
      });
      vi.mocked(signTransaction).mockResolvedValue("signed_xdr");
      vi.mocked(verifyChallenge).mockResolvedValue({ token: "jwt_token" });
      await promise!;
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("login fails if wallet not connected", async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.login();
    });
    expect(result.current.error).toBe("Wallet not connected");
    expect(result.current.loading).toBe(false);
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
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("handles challenge fetch failure", async () => {
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
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  it("handles sign transaction failure", async () => {
    act(() => {
      useWalletStore.getState().connect("G123", "TESTNET");
    });
    vi.mocked(fetchChallenge).mockResolvedValue({
      transaction: "xdr_data",
      network_passphrase: "Test SDF Network ; September 2015",
    });
    vi.mocked(signTransaction).mockRejectedValue(
      new Error("User rejected signing"),
    );

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login();
    });

    expect(result.current.error).toBe("User rejected signing");
    expect(result.current.token).toBeNull();
  });

  it("handles verify challenge failure", async () => {
    act(() => {
      useWalletStore.getState().connect("G123", "TESTNET");
    });
    vi.mocked(fetchChallenge).mockResolvedValue({
      transaction: "xdr_data",
      network_passphrase: "Test SDF Network ; September 2015",
    });
    vi.mocked(signTransaction).mockResolvedValue("signed_xdr");
    vi.mocked(verifyChallenge).mockRejectedValue(
      new Error("Invalid signature"),
    );

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login();
    });

    expect(result.current.error).toBe("Invalid signature");
    expect(result.current.token).toBeNull();
  });

  it("handles non-Error rejection", async () => {
    act(() => {
      useWalletStore.getState().connect("G123", "TESTNET");
    });
    vi.mocked(fetchChallenge).mockRejectedValue("Something went wrong");

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login();
    });

    expect(result.current.error).toBe("Authentication failed");
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
    expect(result.current.token).toBeNull();
    expect(useWalletStore.getState().address).toBeNull();
  });
});
