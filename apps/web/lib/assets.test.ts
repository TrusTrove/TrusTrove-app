import { describe, expect, it } from "vitest";
import {
  ASSET_INFO,
  ASSET_OPTIONS,
  STROOP_DIVISOR,
  formatAmount,
  numberToStroops,
  stroopsToNumber,
} from "./assets";

describe("asset helpers", () => {
  it("formats default and asset-specific amounts", () => {
    expect(formatAmount(undefined)).toBe("0.00 USDC");
    expect(formatAmount(1_234_567_890n)).toBe("123.46 USDC");
    expect(formatAmount(1_234_567n, "XLM")).toBe("0.12 XLM");
  });

  it("converts stroops to numbers using the shared divisor", () => {
    expect(stroopsToNumber(BigInt(STROOP_DIVISOR) * 2n)).toBe(2);
    expect(stroopsToNumber(1n)).toBe(0.0000001);
  });

  it("floors fractional amounts before converting them to stroops", () => {
    expect(numberToStroops(1.23456789)).toBe(12_345_678n);
    expect(numberToStroops(0.00000009)).toBe(0n);
  });

  it("exposes metadata and selectable options for both assets", () => {
    expect(ASSET_OPTIONS).toEqual([
      { value: "USDC", label: "USDC" },
      { value: "XLM", label: "XLM" },
    ]);
    expect(ASSET_INFO.USDC).toMatchObject({
      type: "USDC",
      isNative: false,
      decimals: 7,
    });
    expect(ASSET_INFO.XLM).toMatchObject({
      type: "XLM",
      isNative: true,
      issuer: null,
      decimals: 7,
    });
  });
});