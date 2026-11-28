import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getExpectedNetwork, validateConfig } from "./config";

describe("config helpers", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.NEXT_PUBLIC_INVOICE_CONTRACT_ID;
    delete process.env.NEXT_PUBLIC_POOL_CONTRACT_ID;
    delete process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID;
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    vi.restoreAllMocks();
  });

  it("validates successfully when all required environment variables are set", async () => {
    process.env.NEXT_PUBLIC_INVOICE_CONTRACT_ID = "C123";
    process.env.NEXT_PUBLIC_POOL_CONTRACT_ID = "C456";
    process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID = "C789";

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = validateConfig();

    expect(result).toEqual({
      missing: [],
      isConfigured: true,
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("identifies missing environment variables and logs a warning", async () => {
    process.env.NEXT_PUBLIC_INVOICE_CONTRACT_ID = "C123";
    process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID = "";

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = validateConfig();

    expect(result.isConfigured).toBe(false);
    expect(result.missing).toEqual([
      "NEXT_PUBLIC_POOL_CONTRACT_ID",
      "NEXT_PUBLIC_REGISTRY_CONTRACT_ID",
    ]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      "[TrusTrove] Missing required environment variables: NEXT_PUBLIC_POOL_CONTRACT_ID, NEXT_PUBLIC_REGISTRY_CONTRACT_ID",
    );
  });

  it("caches the validation result on subsequent calls", async () => {
    process.env.NEXT_PUBLIC_INVOICE_CONTRACT_ID = "C123";
    process.env.NEXT_PUBLIC_POOL_CONTRACT_ID = "C456";
    process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID = "C789";

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const firstResult = validateConfig();

    delete process.env.NEXT_PUBLIC_INVOICE_CONTRACT_ID;

    const secondResult = validateConfig();

    expect(secondResult).toBe(firstResult);
    expect(secondResult.isConfigured).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe("getExpectedNetwork", () => {
  const originalEnv = process.env.NEXT_PUBLIC_STELLAR_NETWORK;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_STELLAR_NETWORK;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_STELLAR_NETWORK = originalEnv;
    } else {
      delete process.env.NEXT_PUBLIC_STELLAR_NETWORK;
    }
  });

  it("defaults to testnet when env var is unset", () => {
    const net = getExpectedNetwork();
    expect(net.name).toBe("testnet");
    expect(net.freighterNetwork).toBe("TESTNET");
    expect(net.label).toBe("SOROBAN TESTNET — PROTOCOL V1.0");
  });

  it("recognizes testnet config", () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "testnet";
    const net = getExpectedNetwork();
    expect(net.name).toBe("testnet");
    expect(net.freighterNetwork).toBe("TESTNET");
  });

  it("recognizes mainnet config", () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "mainnet";
    const net = getExpectedNetwork();
    expect(net.name).toBe("mainnet");
    expect(net.freighterNetwork).toBe("PUBLIC");
    expect(net.label).toBe("SOROBAN MAINNET");
  });

  it("recognizes public config as mainnet", () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "PUBLIC";
    const net = getExpectedNetwork();
    expect(net.name).toBe("mainnet");
    expect(net.freighterNetwork).toBe("PUBLIC");
  });

  it("recognizes mainnet config and exposes expected properties", () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "mainnet";
    const net = getExpectedNetwork();
    expect(net.name).toBe("mainnet");
    expect(net.freighterNetwork).toBe("PUBLIC");
    expect(net.label).toBe("SOROBAN MAINNET");
  });
});
