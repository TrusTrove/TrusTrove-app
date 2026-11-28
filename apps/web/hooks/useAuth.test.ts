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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

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
      () =>
        new Promise((resolve) => {
          resolveChallenge = resolve;
        }),
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
    expect(result.current.error).toBe(
      "Please connect your wallet to perform this action",
    );
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

    expect(result.current.error).toBe("Something went wrong");
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

  it("logout clears a loading flag left by an in-flight login", () => {
    vi.mocked(fetchChallenge).mockImplementation(() => new Promise(() => {}));

    act(() => {
      useWalletStore.getState().connect("G123", "TESTNET");
    });

    const { result } = renderHook(() => useAuth());

    act(() => {
      void result.current.login();
    });
    expect(result.current.loading).toBe(true);

    act(() => {
      result.current.logout();
    });

    expect(result.current.loading).toBe(false);
  });

  it("does not apply a token from a login that was in flight at logout", async () => {
    const verify = deferred<{ token: string }>();
    vi.mocked(fetchChallenge).mockResolvedValue({
      transaction: "xdr_data",
      network_passphrase: "Test SDF Network ; September 2015",
    });
    vi.mocked(signTransaction).mockResolvedValue("signed_xdr");
    vi.mocked(verifyChallenge).mockReturnValue(verify.promise);

    act(() => {
      useWalletStore.getState().connect("G123", "TESTNET");
    });

    const { result } = renderHook(() => useAuth());

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.login();
    });

    act(() => {
      result.current.logout();
    });

    await act(async () => {
      verify.resolve({ token: "late_jwt_token" });
      await pending;
    });

    expect(result.current.token).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(useWalletStore.getState().token).toBeNull();
  });

  it("does not surface or clear state for a login that failed after logout", async () => {
    const challenge = deferred<{
      transaction: string;
      network_passphrase: string;
    }>();
    vi.mocked(fetchChallenge).mockReturnValue(challenge.promise);

    act(() => {
      useWalletStore.getState().connect("G123", "TESTNET");
    });

    const { result } = renderHook(() => useAuth());

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.login();
    });

    act(() => {
      result.current.logout();
    });

    // A newer session is already authenticated by the time the abandoned
    // attempt fails; its late failure must not wipe that token or raise a
    // banner the user never triggered.
    act(() => {
      useWalletStore.getState().connect("G456", "TESTNET");
      useWalletStore.getState().setToken("new_session_jwt");
    });

    await act(async () => {
      challenge.reject(new Error("Fetch failed"));
      await pending;
    });

    expect(result.current.error).toBeNull();
    expect(useWalletStore.getState().token).toBe("new_session_jwt");
  });
});
