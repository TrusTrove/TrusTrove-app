import { describe, it, expect } from "vitest";
import { validateConfig } from "./config";

describe("validateConfig", () => {
  it("detects missing and invalid configuration values", () => {
    const res = validateConfig({
      NEXT_PUBLIC_INVOICE_CONTRACT_ID: "invalid",
    });
    expect(res.missing).toContain("NEXT_PUBLIC_POOL_CONTRACT_ID");
    expect(res.invalid).toContain("NEXT_PUBLIC_INVOICE_CONTRACT_ID");
  });
});
