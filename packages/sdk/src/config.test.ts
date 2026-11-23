import { describe, it, expect, vi } from "vitest";
import { rpc, Networks } from "@stellar/stellar-sdk";

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@stellar/stellar-sdk")>();
  return {
    ...actual,
    rpc: {
      ...actual.rpc,
      Server: class MockServer {
        url: string;
        constructor(url: string) {
          this.url = url;
        }
      } as any,
    },
  };
});

import {
  DEFAULT_NETWORK,
  DEFAULT_CONTRACTS,
  DEFAULT_USDC,
  DEFAULT_TX_TIMEOUT_SECONDS,
  DEFAULT_TX_POLL_MAX_ATTEMPTS,
  DEFAULT_TX_POLL_INTERVAL_MS,
  DEFAULT_RETRY_MAX_ATTEMPTS,
  DEFAULT_RETRY_BASE_DELAY_MS,
  DEFAULT_BASE_FEE,
  MAX_BASE_FEE,
  DEFAULT_ALLOWANCE_EXPIRY_LEDGERS,
  configureSDK,
  getConfig,
  getSorobanServer,
} from "./config.js";

describe("config", () => {
  describe("DEFAULT_NETWORK", () => {
    it("has sensible defaults for testnet", () => {
      expect(DEFAULT_NETWORK.network).toBe("testnet");
      expect(DEFAULT_NETWORK.horizonUrl).toBe(
        "https://horizon-testnet.stellar.org",
      );
      expect(DEFAULT_NETWORK.sorobanRpcUrl).toBe(
        "https://soroban-testnet.stellar.org",
      );
      expect(DEFAULT_NETWORK.networkPassphrase).toBe(Networks.TESTNET);
    });
  });

  describe("DEFAULT_CONTRACTS", () => {
    it("has string fallback contract IDs", () => {
      expect(DEFAULT_CONTRACTS.registry).toBeTypeOf("string");
      expect(DEFAULT_CONTRACTS.invoice).toBeTypeOf("string");
      expect(DEFAULT_CONTRACTS.pool).toBeTypeOf("string");
      expect(DEFAULT_CONTRACTS.escrow).toBeTypeOf("string");
    });
  });

  describe("DEFAULT_USDC", () => {
    it("defaults to the well-known USDC issuer and asset code", () => {
      expect(DEFAULT_USDC.issuer).toBe(
        "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
      );
      expect(DEFAULT_USDC.assetCode).toBe("USDC");
    });
  });

  describe("configureSDK / getConfig", () => {
    it("getConfig returns the default config before any configureSDK call", () => {
      const config = getConfig();
      expect(config.horizonUrl).toBe(DEFAULT_NETWORK.horizonUrl);
      expect(config.sorobanRpcUrl).toBe(DEFAULT_NETWORK.sorobanRpcUrl);
      expect(config.networkPassphrase).toBe(DEFAULT_NETWORK.networkPassphrase);
      expect(config.contractIds).toEqual({
        registry: DEFAULT_CONTRACTS.registry,
        invoice: DEFAULT_CONTRACTS.invoice,
        pool: DEFAULT_CONTRACTS.pool,
        escrow: DEFAULT_CONTRACTS.escrow,
        agentRegistry: DEFAULT_CONTRACTS.agentRegistry,
      });
      expect(config.usdc).toEqual({
        issuer: DEFAULT_USDC.issuer,
        assetCode: DEFAULT_USDC.assetCode,
      });
      expect(config.txTimeoutSeconds).toBe(30);
      expect(config.txPollMaxAttempts).toBe(30);
      expect(config.txPollIntervalMs).toBe(1000);
      expect(config.retryMaxAttempts).toBe(3);
      expect(config.retryBaseDelayMs).toBe(1000);
      expect(config.baseFee).toBe(100);
      expect(config.allowanceExpiryLedgers).toBe(535_680);
    });

    it("shallow-merges top-level keys via configureSDK", () => {
      configureSDK({ horizonUrl: "https://custom-horizon.example.com" });
      const config = getConfig();
      expect(config.horizonUrl).toBe("https://custom-horizon.example.com");
      expect(config.sorobanRpcUrl).toBe(DEFAULT_NETWORK.sorobanRpcUrl);
    });

    it("deep-merges contractIds via configureSDK", () => {
      configureSDK({
        contractIds: {
          registry: "C_NEW_REG",
          invoice: "",
          pool: "",
          escrow: "",
        },
      } as any);
      const config = getConfig();
      expect(config.contractIds.registry).toBe("C_NEW_REG");
      expect(config.contractIds.invoice).toBe(DEFAULT_CONTRACTS.invoice);
      expect(config.contractIds.pool).toBe(DEFAULT_CONTRACTS.pool);
      expect(config.contractIds.escrow).toBe(DEFAULT_CONTRACTS.escrow);
    });

    it("deep-merges usdc via configureSDK", () => {
      configureSDK({
        usdc: { issuer: "G_NEW_ISSUER", assetCode: DEFAULT_USDC.assetCode },
      } as any);
      const config = getConfig();
      expect(config.usdc.issuer).toBe("G_NEW_ISSUER");
      expect(config.usdc.assetCode).toBe(DEFAULT_USDC.assetCode);
    });

    it("returns a copy so writing to it cannot change the active config", () => {
      const before = getConfig();

      const tampered = getConfig();
      tampered.horizonUrl = "https://tampered.example.com";
      tampered.sorobanRpcUrl = "https://tampered.example.com";
      tampered.networkPassphrase = "Tampered Network";
      tampered.contractIds.pool = "CTAMPEREDPOOL";
      tampered.usdc.issuer = "GTAMPEREDISSUER";

      expect(tampered).not.toBe(before);
      expect(getConfig()).toEqual(before);
      expect(getConfig().contractIds.pool).toBe(before.contractIds.pool);
      expect(getConfig().usdc.issuer).toBe(before.usdc.issuer);
    });

    it("keeps nested objects separate on every read", () => {
      expect(getConfig().contractIds).not.toBe(getConfig().contractIds);
      expect(getConfig().usdc).not.toBe(getConfig().usdc);
    });
  });

  describe("getSorobanServer", () => {
    it("creates an rpc.Server using the active sorobanRpcUrl", () => {
      const server = getSorobanServer();
      expect(server).toBeDefined();
      expect((server as any).url).toBe(DEFAULT_NETWORK.sorobanRpcUrl);
    });

    it("reflects a custom sorobanRpcUrl after configureSDK", () => {
      configureSDK({ sorobanRpcUrl: "https://custom-rpc.example.com" });
      const server = getSorobanServer();
      expect((server as any).url).toBe("https://custom-rpc.example.com");
    });
  });

  describe("transaction, polling, retry, fee, and allowance validation", () => {
    it("accepts valid custom configuration values", () => {
      const before = getConfig();
      try {
        configureSDK({
          txTimeoutSeconds: 60,
          txPollMaxAttempts: 15,
          txPollIntervalMs: 500,
          retryMaxAttempts: 5,
          retryBaseDelayMs: 250,
          baseFee: 500,
          allowanceExpiryLedgers: 100_000,
        });
        const updated = getConfig();
        expect(updated.txTimeoutSeconds).toBe(60);
        expect(updated.txPollMaxAttempts).toBe(15);
        expect(updated.txPollIntervalMs).toBe(500);
        expect(updated.retryMaxAttempts).toBe(5);
        expect(updated.retryBaseDelayMs).toBe(250);
        expect(updated.baseFee).toBe(500);
        expect(updated.allowanceExpiryLedgers).toBe(100_000);
      } finally {
        configureSDK({
          txTimeoutSeconds: before.txTimeoutSeconds,
          txPollMaxAttempts: before.txPollMaxAttempts,
          txPollIntervalMs: before.txPollIntervalMs,
          retryMaxAttempts: before.retryMaxAttempts,
          retryBaseDelayMs: before.retryBaseDelayMs,
          baseFee: before.baseFee,
          allowanceExpiryLedgers: before.allowanceExpiryLedgers,
        });
      }
    });

    it.each([
      ["txTimeoutSeconds", 0],
      ["txTimeoutSeconds", -5],
      ["txTimeoutSeconds", 1.5],
      ["txTimeoutSeconds", 3601],
      ["txPollMaxAttempts", 0],
      ["txPollMaxAttempts", -1],
      ["txPollMaxAttempts", 2.5],
      ["txPollMaxAttempts", 1001],
      ["txPollIntervalMs", 0],
      ["txPollIntervalMs", -10],
      ["txPollIntervalMs", 10.5],
      ["txPollIntervalMs", 60_001],
      ["retryMaxAttempts", 0],
      ["retryMaxAttempts", -1],
      ["retryMaxAttempts", 1.2],
      ["retryMaxAttempts", 21],
      ["retryBaseDelayMs", 0],
      ["retryBaseDelayMs", -100],
      ["retryBaseDelayMs", 5.5],
      ["retryBaseDelayMs", 60_001],
      ["baseFee", 0],
      ["baseFee", -100],
      ["baseFee", DEFAULT_BASE_FEE - 1],
      ["baseFee", 100.5],
      ["baseFee", MAX_BASE_FEE + 1],
      ["allowanceExpiryLedgers", 0],
      ["allowanceExpiryLedgers", -1],
      ["allowanceExpiryLedgers", 100.5],
      ["allowanceExpiryLedgers", 10_000_001],
    ] as const)(
      "rejects invalid %s (%s) without mutating active config",
      (field, value) => {
        const before = getConfig();
        expect(() => configureSDK({ [field]: value })).toThrow(
          new RegExp(`Invalid SDKConfig\\.${field}`),
        );
        expect(getConfig()).toEqual(before);
      },
    );

    it("exports default constants matching legacy behavior", () => {
      expect(DEFAULT_TX_TIMEOUT_SECONDS).toBe(30);
      expect(DEFAULT_TX_POLL_MAX_ATTEMPTS).toBe(30);
      expect(DEFAULT_TX_POLL_INTERVAL_MS).toBe(1000);
      expect(DEFAULT_RETRY_MAX_ATTEMPTS).toBe(3);
      expect(DEFAULT_RETRY_BASE_DELAY_MS).toBe(1000);
      expect(DEFAULT_BASE_FEE).toBe(100);
      expect(MAX_BASE_FEE).toBe(10_000_000);
      expect(DEFAULT_ALLOWANCE_EXPIRY_LEDGERS).toBe(535_680);
    });
  });
});
