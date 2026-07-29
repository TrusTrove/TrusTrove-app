import { describe, it, expect, beforeEach } from "vitest";
import { useWalletStore } from "@/store/wallet";

beforeEach(() => {
  localStorage.clear();
  useWalletStore.setState({
    address: null,
    connected: false,
    network: null,
    token: null,
    role: "issuer",
  });
});

describe("wallet store", () => {
  it("initial state", () => {
    const state = useWalletStore.getState();
    expect(state.address).toBeNull();
    expect(state.connected).toBe(false);
    expect(state.network).toBeNull();
    expect(state.token).toBeNull();
    expect(state.role).toBe("issuer");
  });

  it("connect() sets address, connected, and network", () => {
    useWalletStore.getState().connect("GA123", "testnet");
    const state = useWalletStore.getState();
    expect(state.address).toBe("GA123");
    expect(state.connected).toBe(true);
    expect(state.network).toBe("testnet");
  });

  it("connect() overwrites previous state", () => {
    useWalletStore.getState().connect("GA123", "testnet");
    useWalletStore.getState().connect("GA456", "mainnet");
    const state = useWalletStore.getState();
    expect(state.address).toBe("GA456");
    expect(state.connected).toBe(true);
    expect(state.network).toBe("mainnet");
  });

  it("disconnect() resets all state to defaults", () => {
    useWalletStore.getState().connect("GA123", "testnet");
    useWalletStore.getState().setToken("some-token");
    useWalletStore.getState().setRole("lp");

    useWalletStore.getState().disconnect();

    const state = useWalletStore.getState();
    expect(state.address).toBeNull();
    expect(state.connected).toBe(false);
    expect(state.network).toBeNull();
    expect(state.token).toBeNull();
    expect(state.role).toBe("issuer");
  });

  it("disconnect() is idempotent when already disconnected", () => {
    useWalletStore.getState().disconnect();
    const state = useWalletStore.getState();
    expect(state.address).toBeNull();
    expect(state.connected).toBe(false);
  });

  it("setAddress() sets address and connected", () => {
    useWalletStore.getState().setAddress("GB789");
    const state = useWalletStore.getState();
    expect(state.address).toBe("GB789");
    expect(state.connected).toBe(true);
  });

  it("setAddress(null) clears address and sets connected to false", () => {
    useWalletStore.getState().connect("GA123", "testnet");
    useWalletStore.getState().setAddress(null);
    const state = useWalletStore.getState();
    expect(state.address).toBeNull();
    expect(state.connected).toBe(false);
  });

  it("setNetwork() updates network", () => {
    useWalletStore.getState().setNetwork("futurenet");
    expect(useWalletStore.getState().network).toBe("futurenet");
  });

  it("setNetwork(null) clears network", () => {
    useWalletStore.getState().setNetwork("testnet");
    useWalletStore.getState().setNetwork(null);
    expect(useWalletStore.getState().network).toBeNull();
  });

  it("setToken() updates token", () => {
    useWalletStore.getState().setToken("jwt-token");
    expect(useWalletStore.getState().token).toBe("jwt-token");
  });

  it("setToken(null) clears token", () => {
    useWalletStore.getState().setToken("jwt-token");
    useWalletStore.getState().setToken(null);
    expect(useWalletStore.getState().token).toBeNull();
  });

  it("setRole() accepts 'issuer'", () => {
    useWalletStore.getState().setRole("issuer");
    expect(useWalletStore.getState().role).toBe("issuer");
  });

  it("setRole() accepts 'buyer'", () => {
    useWalletStore.getState().setRole("buyer");
    expect(useWalletStore.getState().role).toBe("buyer");
  });

  it("setRole() accepts 'lp'", () => {
    useWalletStore.getState().setRole("lp");
    expect(useWalletStore.getState().role).toBe("lp");
  });

  it("partialize persists only address, network, and role", () => {
    useWalletStore.getState().connect("GA123", "testnet");
    useWalletStore.getState().setToken("jwt");
    useWalletStore.getState().setRole("buyer");

    const raw = localStorage.getItem("wallet-storage");
    expect(raw).not.toBeNull();

    const persisted = JSON.parse(raw!);
    expect(persisted.state.address).toBe("GA123");
    expect(persisted.state.network).toBe("testnet");
    expect(persisted.state.role).toBe("buyer");
    expect(persisted.state).not.toHaveProperty("connected");
    expect(persisted.state).not.toHaveProperty("token");
  });

  it("partialize excludes token and connected from localStorage", () => {
    useWalletStore.getState().setToken("secret");
    const raw = localStorage.getItem("wallet-storage");
    const persisted = JSON.parse(raw!);
    expect(persisted.state.token).toBeUndefined();
    expect(persisted.state.connected).toBeUndefined();
  });

  it("persist middleware stores state under correct key", () => {
    useWalletStore.getState().connect("GA123", "testnet");
    const raw = localStorage.getItem("wallet-storage");
    expect(raw).not.toBeNull();
  });
});
