import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { validateConfig } from "@/lib/config";

describe("Regression: Polling lifecycle and config validation (PR #176)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Config validation logic", () => {
    it("reports missing variables when cleared via validateConfig", () => {
      const originalInvoice = process.env.NEXT_PUBLIC_INVOICE_CONTRACT_ID;
      delete process.env.NEXT_PUBLIC_INVOICE_CONTRACT_ID;
      try {
        const cfg = validateConfig();
        expect(cfg.missing.length).toBeGreaterThan(0);
      } finally {
        if (originalInvoice)
          process.env.NEXT_PUBLIC_INVOICE_CONTRACT_ID = originalInvoice;
      }
    });
  });
});
