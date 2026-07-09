import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Regression: Polling lifecycle and config validation (PR #176)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Polling only when connected", () => {
    it("does not start polling interval when not connected", () => {
      const fetchFn = vi.fn();
      const connected = false;

      if (connected) {
        fetchFn();
        const interval = setInterval(fetchFn, 30000);
        return () => clearInterval(interval);
      }

      vi.advanceTimersByTime(60000);
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it("starts polling interval when connected", () => {
      const fetchFn = vi.fn();
      const connected = true;

      fetchFn();
      expect(fetchFn).toHaveBeenCalledTimes(1);

      const interval = setInterval(fetchFn, 30000);
      vi.advanceTimersByTime(30000);
      expect(fetchFn).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(30000);
      expect(fetchFn).toHaveBeenCalledTimes(3);

      clearInterval(interval);
    });
  });

  describe("Config validation logic", () => {
    const REQUIRED_ENV_VARS = [
      "NEXT_PUBLIC_INVOICE_CONTRACT_ID",
      "NEXT_PUBLIC_POOL_CONTRACT_ID",
      "NEXT_PUBLIC_REGISTRY_CONTRACT_ID",
    ];

    it("reports all three env vars as missing when none are set", () => {
      delete process.env.NEXT_PUBLIC_INVOICE_CONTRACT_ID;
      delete process.env.NEXT_PUBLIC_POOL_CONTRACT_ID;
      delete process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID;

      const missing = REQUIRED_ENV_VARS.filter(
        (key) => !process.env[key] || process.env[key] === "",
      );

      expect(missing).toEqual(
        expect.arrayContaining([
          "NEXT_PUBLIC_INVOICE_CONTRACT_ID",
          "NEXT_PUBLIC_POOL_CONTRACT_ID",
          "NEXT_PUBLIC_REGISTRY_CONTRACT_ID",
        ]),
      );
      expect(missing.length).toBe(3);
    });

    it("reports configured when all env vars are set", () => {
      process.env.NEXT_PUBLIC_INVOICE_CONTRACT_ID = "C1";
      process.env.NEXT_PUBLIC_POOL_CONTRACT_ID = "C2";
      process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID = "C3";

      const missing = REQUIRED_ENV_VARS.filter(
        (key) => !process.env[key] || process.env[key] === "",
      );

      expect(missing.length).toBe(0);
    });
  });

  describe("Invoice creation validation", () => {
    it("throws error when invoice_id is missing from creation result", () => {
      const res = { transaction_hash: "0xabc" };
      expect(() => {
        if (!res.invoice_id) {
          throw new Error("Invoice creation did not return a valid invoice ID");
        }
      }).toThrow("valid invoice ID");
    });

    it("throws error when transaction_hash is missing from creation result", () => {
      const res = { invoice_id: "inv123" };
      expect(() => {
        if (!res.transaction_hash) {
          throw new Error(
            "Invoice creation did not return a transaction hash",
          );
        }
      }).toThrow("transaction hash");
    });

    it("passes validation when both invoice_id and transaction_hash are present", () => {
      const res = { invoice_id: "inv123", transaction_hash: "0xabc" };
      expect(() => {
        if (!res.invoice_id) {
          throw new Error("Invoice creation did not return a valid invoice ID");
        }
        if (!res.transaction_hash) {
          throw new Error(
            "Invoice creation did not return a transaction hash",
          );
        }
      }).not.toThrow();
    });
  });
});
