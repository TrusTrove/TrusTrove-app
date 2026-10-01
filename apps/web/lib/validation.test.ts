import { describe, it, expect } from "vitest";
import { MAX_DISCOUNT_BPS, validateDiscountBps } from "./validation";

describe("MAX_DISCOUNT_BPS", () => {
  it("matches the invoice contract's list_for_financing ceiling", () => {
    // docs/smart-contracts/invoice-contract.md: "Max 5000 (50%)".
    expect(MAX_DISCOUNT_BPS).toBe(5000);
  });
});

describe("validateDiscountBps", () => {
  it("accepts typical discounts", () => {
    expect(validateDiscountBps(1)).toBe(true);
    expect(validateDiscountBps(200)).toBe(true);
    expect(validateDiscountBps(500)).toBe(true);
    expect(validateDiscountBps(2500)).toBe(true);
  });

  it("accepts the maximum the contract allows", () => {
    expect(validateDiscountBps(MAX_DISCOUNT_BPS)).toBe(true);
    expect(validateDiscountBps(5000)).toBe(true);
  });

  it("rejects the first value above the contract cap", () => {
    expect(validateDiscountBps(MAX_DISCOUNT_BPS + 1)).toBe(false);
    expect(validateDiscountBps(5001)).toBe(false);
  });

  // #755 — these used to pass client validation and then fail on-chain,
  // wasting a signed transaction and its network fee.
  it("rejects every value from 5001 through 10000", () => {
    const rejected: number[] = [];
    for (let bps = 5001; bps <= 10000; bps++) {
      if (validateDiscountBps(bps)) rejected.push(bps);
    }
    expect(rejected).toEqual([]);
  });

  it("rejects zero and negative values", () => {
    expect(validateDiscountBps(0)).toBe(false);
    expect(validateDiscountBps(-1)).toBe(false);
    expect(validateDiscountBps(-5000)).toBe(false);
  });

  it("rejects non-integers", () => {
    expect(validateDiscountBps(200.5)).toBe(false);
    expect(validateDiscountBps(4999.99)).toBe(false);
  });

  it("rejects NaN and infinities", () => {
    expect(validateDiscountBps(Number.NaN)).toBe(false);
    expect(validateDiscountBps(Number.POSITIVE_INFINITY)).toBe(false);
    expect(validateDiscountBps(Number.NEGATIVE_INFINITY)).toBe(false);
  });
});
