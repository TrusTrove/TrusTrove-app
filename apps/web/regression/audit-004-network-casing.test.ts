import { describe, it, expect, vi, beforeEach } from "vitest";
import { normalizeNetworkForAuth } from "../hooks/useAuth";
import { normalizeNetworkForWallet } from "../hooks/useWallet";

describe("Regression: Network name casing normalization (PR #105)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("useAuth normalization (uppercase for Freighter API)", () => {
    it('normalizes "testnet" to "TESTNET"', () => {
      expect(normalizeNetworkForAuth("testnet")).toBe("TESTNET");
    });

    it('normalizes "TESTNET" to "TESTNET"', () => {
      expect(normalizeNetworkForAuth("TESTNET")).toBe("TESTNET");
    });

    it('normalizes "TestNet" to "TESTNET"', () => {
      expect(normalizeNetworkForAuth("TestNet")).toBe("TESTNET");
    });

    it('returns "PUBLIC" for "PUBLIC" input', () => {
      expect(normalizeNetworkForAuth("PUBLIC")).toBe("PUBLIC");
    });

    it('returns "PUBLIC" for "public" input', () => {
      expect(normalizeNetworkForAuth("public")).toBe("PUBLIC");
    });

    it("defaults to TESTNET when raw is undefined", () => {
      expect(normalizeNetworkForAuth(undefined)).toBe("TESTNET");
    });
  });

  describe("useWallet normalization (lowercase for store display)", () => {
    it('normalizes "TESTNET" to "testnet"', () => {
      expect(normalizeNetworkForWallet("TESTNET")).toBe("testnet");
    });

    it('normalizes "TestNet" to "testnet"', () => {
      expect(normalizeNetworkForWallet("TestNet")).toBe("testnet");
    });

    it('normalizes "testnet" to "testnet"', () => {
      expect(normalizeNetworkForWallet("testnet")).toBe("testnet");
    });

    it("defaults to testnet when raw is undefined", () => {
      expect(normalizeNetworkForWallet(undefined)).toBe("testnet");
    });
  });
});
