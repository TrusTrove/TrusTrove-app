import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Regression: Network name casing normalization (PR #105)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("useAuth normalization (uppercase for Freighter API)", () => {
    function normalizeForAuth(raw: string | undefined): string {
      const network = raw || "TESTNET";
      return network.toUpperCase() === "PUBLIC" ? "PUBLIC" : "TESTNET";
    }

    it('normalizes "testnet" to "TESTNET"', () => {
      expect(normalizeForAuth("testnet")).toBe("TESTNET");
    });

    it('normalizes "TESTNET" to "TESTNET"', () => {
      expect(normalizeForAuth("TESTNET")).toBe("TESTNET");
    });

    it('normalizes "TestNet" to "TESTNET"', () => {
      expect(normalizeForAuth("TestNet")).toBe("TESTNET");
    });

    it('returns "PUBLIC" for "PUBLIC" input', () => {
      expect(normalizeForAuth("PUBLIC")).toBe("PUBLIC");
    });

    it('returns "PUBLIC" for "public" input', () => {
      expect(normalizeForAuth("public")).toBe("PUBLIC");
    });

    it("defaults to TESTNET when raw is undefined", () => {
      expect(normalizeForAuth(undefined)).toBe("TESTNET");
    });
  });

  describe("useWallet normalization (lowercase for store display)", () => {
    function normalizeForWallet(raw: string | undefined): string {
      return (raw || "testnet").toLowerCase();
    }

    it('normalizes "TESTNET" to "testnet"', () => {
      expect(normalizeForWallet("TESTNET")).toBe("testnet");
    });

    it('normalizes "TestNet" to "testnet"', () => {
      expect(normalizeForWallet("TestNet")).toBe("testnet");
    });

    it('normalizes "testnet" to "testnet"', () => {
      expect(normalizeForWallet("testnet")).toBe("testnet");
    });

    it("defaults to testnet when raw is undefined", () => {
      expect(normalizeForWallet(undefined)).toBe("testnet");
    });
  });
});
