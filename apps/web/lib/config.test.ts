import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
    const { validateConfig } = await import("./config");

    const result = validateConfig();

    expect(result).toEqual({
      missing: [],
      isConfigured: true,
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("identifies missing environment variables and logs a warning", async () => {
    process.env.NEXT_PUBLIC_INVOICE_CONTRACT_ID = "C123";
    // NEXT_PUBLIC_POOL_CONTRACT_ID is missing
    // NEXT_PUBLIC_REGISTRY_CONTRACT_ID is empty string
    process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID = "";

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { validateConfig } = await import("./config");

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
    const { validateConfig } = await import("./config");

    const firstResult = validateConfig();

    // Mutate env vars after initial validation to prove cached result is returned
    delete process.env.NEXT_PUBLIC_INVOICE_CONTRACT_ID;

    const secondResult = validateConfig();

    expect(secondResult).toBe(firstResult);
    expect(secondResult.isConfigured).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
