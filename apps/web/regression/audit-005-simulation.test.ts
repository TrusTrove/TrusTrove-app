import { describe, it, expect, vi, beforeEach } from "vitest";
import { SIMULATION_PLACEHOLDER_INVOICE_ID, simulateInvoiceCreation } from "../components/invoice/InvoiceForm";

describe("Regression: InvoiceForm simulation and debounce fixes", () => {
  describe("Simulation placeholder ID (issue #81)", () => {
    it("uses the correct zero-byte placeholder ID constant from InvoiceForm", () => {
      expect(SIMULATION_PLACEHOLDER_INVOICE_ID).toBe(
        "0000000000000000000000000000000000000000000000000000000000000000",
      );
    });

    it("placeholder has valid hex length (64 hex chars = 32 bytes)", () => {
      expect(SIMULATION_PLACEHOLDER_INVOICE_ID.length).toBe(64);
    });

    it("placeholder is a valid hex string", () => {
      expect(/^[0-9a-f]+$/i.test(SIMULATION_PLACEHOLDER_INVOICE_ID)).toBe(true);
    });
  });

  describe("Simulation debounce (issue #80)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it("simulation debounce helper runs after 300ms delay", async () => {
      const fn = vi.fn().mockResolvedValue({});
      const promise = simulateInvoiceCreation(fn);

      vi.advanceTimersByTime(299);
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      await promise;
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});
