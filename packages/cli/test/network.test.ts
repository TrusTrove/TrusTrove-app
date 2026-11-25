import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockConfigureSDK } = vi.hoisted(() => ({
  mockConfigureSDK: vi.fn(),
}));

vi.mock("@trusttrove/sdk", () => ({
  configureSDK: mockConfigureSDK,
}));

import {
  formatNetworkHeader,
  resolveNetwork,
} from "../src/network.js";

const ENV_KEYS = [
  "NEXT_PUBLIC_STELLAR_NETWORK",
  "NEXT_PUBLIC_NETWORK_PASSPHRASE",
  "NEXT_PUBLIC_SOROBAN_RPC_URL",
] as const;

describe("resolveNetwork", () => {
  const originalEnv = new Map(
    ENV_KEYS.map((key) => [key, process.env[key]] as const),
  );

  beforeEach(() => {
    mockConfigureSDK.mockReset();
    for (const key of ENV_KEYS) delete process.env[key];
  });

  afterEach(() => {
    for (const [key, value] of originalEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("selects testnet by default", () => {
    const network = resolveNetwork();

    expect(network.name).toBe("testnet");
    expect(network.sorobanRpcUrl).toBe(
      "https://soroban-testnet.stellar.org",
    );
    expect(network.isCustomRpc).toBe(false);
    expect(mockConfigureSDK).toHaveBeenCalledWith({
      sorobanRpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015",
    });
  });

  it("selects mainnet and its passphrase from --network", () => {
    const network = resolveNetwork({ network: "Mainnet" });

    expect(network.name).toBe("mainnet");
    expect(network.networkPassphrase).toBe(
      "Public Global Stellar Network ; September 2015",
    );
    expect(mockConfigureSDK).toHaveBeenCalledWith({
      sorobanRpcUrl: "https://soroban-mainnet.stellar.org",
      networkPassphrase: "Public Global Stellar Network ; September 2015",
    });
  });

  it("uses a custom RPC URL with the selected network's passphrase", () => {
    const network = resolveNetwork({
      network: "mainnet",
      rpcUrl: "https://rpc.provider.example/stellar",
    });

    expect(network.name).toBe("mainnet");
    expect(network.sorobanRpcUrl).toBe(
      "https://rpc.provider.example/stellar",
    );
    expect(network.isCustomRpc).toBe(true);
  });

  it("infers the network from a known custom RPC host", () => {
    const network = resolveNetwork({
      rpcUrl: "https://mainnet.sorobanrpc.com",
    });

    expect(network.name).toBe("mainnet");
    expect(mockConfigureSDK).toHaveBeenCalledWith({
      sorobanRpcUrl: "https://mainnet.sorobanrpc.com",
      networkPassphrase: "Public Global Stellar Network ; September 2015",
    });
  });

  it("rejects an unknown network", () => {
    expect(() => resolveNetwork({ network: "futurenet" })).toThrow(
      /Unknown network "futurenet"/,
    );
    expect(mockConfigureSDK).not.toHaveBeenCalled();
  });

  it("rejects an invalid RPC URL", () => {
    expect(() => resolveNetwork({ rpcUrl: "ftp://example.com" })).toThrow(
      /Invalid RPC URL/,
    );
  });

  it("rejects --network disagreeing with the environment", () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "testnet";

    expect(() => resolveNetwork({ network: "mainnet" })).toThrow(
      /Conflicting network configuration/,
    );
  });

  it("rejects a passphrase that disagrees with --network", () => {
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE =
      "Test SDF Network ; September 2015";

    expect(() => resolveNetwork({ network: "mainnet" })).toThrow(
      /NEXT_PUBLIC_NETWORK_PASSPHRASE/,
    );
  });

  it("rejects a known RPC host from another network", () => {
    expect(() =>
      resolveNetwork({
        network: "mainnet",
        rpcUrl: "https://soroban-testnet.stellar.org",
      }),
    ).toThrow(/Conflicting network configuration/);
  });

  it("labels an unrecognized passphrase as a custom network", () => {
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE = "Standalone Network ; 2026";

    const network = resolveNetwork();

    expect(network.name).toBe("custom");
    expect(network.networkPassphrase).toBe("Standalone Network ; 2026");
    expect(network.isCustomRpc).toBe(true);
  });

  it("rejects an RPC endpoint that contradicts the env network", () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "testnet";

    expect(() =>
      resolveNetwork({ rpcUrl: "https://soroban-mainnet.stellar.org" }),
    ).toThrow(/Conflicting network configuration/);
  });
});

describe("formatNetworkHeader", () => {
  it("prints the network and a redacted RPC URL", () => {
    const header = formatNetworkHeader({
      name: "mainnet",
      sorobanRpcUrl: "https://user:pass@rpc.example.com/v1?api_key=secret",
      networkPassphrase: "passphrase",
      isCustomRpc: true,
    });

    expect(header).toBe(
      "Network: mainnet (custom RPC)\nRPC: https://***@rpc.example.com/v1?***",
    );
  });
});
