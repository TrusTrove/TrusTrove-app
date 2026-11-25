import { describe, expect, it } from "vitest";
import {
  ASSET_INFO,
  ASSET_OPTIONS,
  STROOP_DIVISOR,
  formatAmount,
  fundedValueStroops,
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

  describe("fundedValueStroops", () => {
    it("applies a basis-point discount to a face value", () => {
      expect(fundedValueStroops(1_000_000_000n, 500)).toBe(950_000_000n);
      expect(fundedValueStroops(1_000_000_000n, 0)).toBe(1_000_000_000n);
      expect(fundedValueStroops(1_000_000_000n, 10_000)).toBe(0n);
    });

    it("rounds the fee up to the nearest stroop", () => {
      // 1 stroop at 1 bps is 0.0001 of a stroop of fee: rounded up, the whole
      // face value is consumed instead of the fee rounding down to zero.
      expect(fundedValueStroops(1n, 1)).toBe(0n);
      // 3 stroops at 5000 bps is exactly 1.5 stroops of fee, rounded up.
      expect(fundedValueStroops(3n, 5000)).toBe(1n);
    });

    it("agrees with the previous float calculation for ordinary magnitudes", () => {
      const cases: [bigint, number][] = [
        [1_234_567_890n, 500],
        [10_000_000_000n, 333],
        [999_999_999n, 7],
        [500_000_001n, 1],
      ];
      for (const [faceValue, discountBps] of cases) {
        const floatValue = Number(faceValue);
        const legacy = BigInt(
          Math.floor(floatValue - floatValue * (discountBps / 10000)),
        );
        expect(fundedValueStroops(faceValue, discountBps)).toBe(legacy);
      }
    });

    it("asserts the exact bigint above 2^53, where Number cannot represent the input", () => {
      const faceValue = 2n ** 53n + 3n; // 9007199254740995n
      expect(faceValue > BigInt(Number.MAX_SAFE_INTEGER)).toBe(true);

      // ceil(9007199254740995 / 10000) = 900719925475 of fee.
      expect(fundedValueStroops(faceValue, 1)).toBe(9006298534815520n);

      // The float path rounds the input to an even stroop and the subtraction
      // rounds up before Math.floor, landing 2 stroops high.
      const floatValue = Number(faceValue);
      const legacy = BigInt(Math.floor(floatValue - floatValue * (1 / 10000)));
      expect(legacy).toBe(9006298534815522n);
    });

    it("keeps a nine-figure USDC invoice precise", () => {
      // ~900M USDC is where the issue reports the preview going wrong.
      const faceValue = 9_000_000_000_000_001n;
      expect(fundedValueStroops(faceValue, 25)).toBe(8977500000000000n);
      const floatValue = Number(faceValue);
      expect(BigInt(Math.floor(floatValue - floatValue * (25 / 10000)))).toBe(
        8977500000000001n,
      );
    });

    it("refuses a fractional basis-point rate", () => {
      expect(() => fundedValueStroops(1_000_000n, 12.5)).toThrow(TypeError);
      expect(() => fundedValueStroops(1_000_000n, Number.NaN)).toThrow(
        TypeError,
      );
    });
  });
});
