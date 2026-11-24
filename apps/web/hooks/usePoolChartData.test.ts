import { renderHook } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { usePoolChartData } from "./usePoolChartData";
import type { ChartDataItem } from "./usePoolChartData";

function makeData(values: number[]): ChartDataItem[] {
  return values.map((v, i) => ({ label: `Day ${i}`, value: v }));
}

describe("usePoolChartData", () => {
  it("returns empty paths for no data", () => {
    const { result } = renderHook(() => usePoolChartData({ data: [] }));

    expect(result.current.linePath).toBe("");
    expect(result.current.areaPath).toBe("");
    expect(result.current.points).toEqual([]);
  });

  it("returns empty paths for undefined data", () => {
    const { result } = renderHook(() =>
      usePoolChartData({ data: undefined as unknown as ChartDataItem[] }),
    );

    expect(result.current.linePath).toBe("");
    expect(result.current.areaPath).toBe("");
    expect(result.current.points).toEqual([]);
  });

  it("renders a single-point chart without NaN values (happy path)", () => {
    const data = makeData([42]);
    const { result } = renderHook(() => usePoolChartData({ data }));

    expect(result.current.points).toHaveLength(1);
    expect(result.current.linePath).toBe(
      `M ${20 + (500 - 40) / 2} ${20 + (200 - 40) - ((42 - 42) / 1) * (200 - 40)}`,
    );

    // No NaN in points
    result.current.points.forEach((pt) => {
      expect(Number.isNaN(pt.x)).toBe(false);
      expect(Number.isNaN(pt.y)).toBe(false);
    });

    // Path strings are valid (contain no NaN)
    expect(result.current.linePath).not.toContain("NaN");
    expect(result.current.areaPath).not.toContain("NaN");
  });

  it("places the single point at horizontal center of the chart", () => {
    const data = makeData([100]);
    const { result } = renderHook(() =>
      usePoolChartData({ data, width: 500, height: 200, padding: 20 }),
    );

    const expectedX = 20 + (500 - 40) / 2; // padding + chartWidth / 2
    expect(result.current.points[0].x).toBe(expectedX);
  });

  it("correctly maps multiple data points without NaN", () => {
    const data = makeData([10, 20, 30, 40, 50]);
    const { result } = renderHook(() => usePoolChartData({ data }));

    expect(result.current.points).toHaveLength(5);

    result.current.points.forEach((pt) => {
      expect(Number.isNaN(pt.x)).toBe(false);
      expect(Number.isNaN(pt.y)).toBe(false);
    });

    expect(result.current.linePath).not.toContain("NaN");
    expect(result.current.areaPath).not.toContain("NaN");

    // Points should be spread across chart width
    const xValues = result.current.points.map((p) => p.x);
    expect(xValues[0]).toBeLessThan(xValues[xValues.length - 1]);
  });

  it("handles two data points without divide-by-zero", () => {
    const data = makeData([0, 100]);
    const { result } = renderHook(() => usePoolChartData({ data }));

    expect(result.current.points).toHaveLength(2);
    result.current.points.forEach((pt) => {
      expect(Number.isNaN(pt.x)).toBe(false);
      expect(Number.isNaN(pt.y)).toBe(false);
    });
    expect(result.current.linePath).not.toContain("NaN");
  });

  it("normalizes equal values to chart midpoint", () => {
    const data = makeData([50, 50, 50]);
    const { result } = renderHook(() => usePoolChartData({ data }));

    // All y values should be the same (midpoint of chart)
    const yValues = result.current.points.map((p) => p.y);
    expect(yValues[0]).toBe(yValues[1]);
    expect(yValues[1]).toBe(yValues[2]);
  });
});

describe("useIssuerConcentration", () => {
  it("returns empty result for undefined or empty invoices", () => {
    const { result } = renderHook(() => useIssuerConcentration(undefined));
    expect(result.current.items).toEqual([]);
    expect(result.current.totalExposure).toBe(0n);
    expect(result.current.activeCount).toBe(0);
  });

  it("calculates concentration and reconciles totals", () => {
    const invoices = [
      {
        id: "1",
        status: "Funded",
        issuer: "ISSUER_A11111111111111111111111111111111",
        buyer: "BUYER1",
        faceValue: 100n,
        asset: "USDC",
        discountBps: 100,
        fundedAmount: 50_000_000n,
        dueDate: 100,
        createdAt: 10,
        fundedAt: 20,
        shippedAt: null,
        issuerConfirmed: false,
        buyerConfirmed: false,
        repaidAt: null,
      },
      {
        id: "2",
        status: "Active",
        issuer: "ISSUER_B22222222222222222222222222222222",
        buyer: "BUYER2",
        faceValue: 100n,
        asset: "USDC",
        discountBps: 100,
        fundedAmount: 30_000_000n,
        dueDate: 100,
        createdAt: 10,
        fundedAt: 20,
        shippedAt: null,
        issuerConfirmed: false,
        buyerConfirmed: false,
        repaidAt: null,
      },
      // Unfunded or non-active invoice should be excluded
      {
        id: "3",
        status: "Created",
        issuer: "ISSUER_C33333333333333333333333333333333",
        buyer: "BUYER3",
        faceValue: 100n,
        asset: "USDC",
        discountBps: 100,
        fundedAmount: 0n,
        dueDate: 100,
        createdAt: 10,
        fundedAt: null,
        shippedAt: null,
        issuerConfirmed: false,
        buyerConfirmed: false,
        repaidAt: null,
      },
    ];

    const { result } = renderHook(() => useIssuerConcentration(invoices));

    expect(result.current.activeCount).toBe(2);
    expect(result.current.totalExposure).toBe(80_000_000n);
    expect(result.current.totalExposureUsdc).toBe(8);
    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[0].amount).toBe(50_000_000n);
    expect(result.current.items[0].percentage).toBe(62.5);
    expect(result.current.items[1].amount).toBe(30_000_000n);
    expect(result.current.items[1].percentage).toBe(37.5);
  });

  it("groups remaining issuers into Other bucket", () => {
    const invoices = ["A", "B", "C", "D", "E"].map((char, i) => ({
      id: `${i}`,
      status: "Funded" as const,
      issuer: `ISSUER_${char}1111111111111111111111111111111111`,
      buyer: "BUYER",
      faceValue: 100n,
      asset: "USDC",
      discountBps: 100,
      fundedAmount: BigInt((i + 1) * 10_000_000),
      dueDate: 100,
      createdAt: 10,
      fundedAt: 20,
      shippedAt: null,
      issuerConfirmed: false,
      buyerConfirmed: false,
      repaidAt: null,
    }));

    const { result } = renderHook(() => useIssuerConcentration(invoices, 2));

    // Top limit 2 means E (50 USDC) and D (40 USDC) sorted desc or similar, plus Other bucket
    expect(result.current.items.some((item) => item.issuer === "other")).toBe(true);
    const sumItems = result.current.items.reduce(
      (acc, item) => acc + item.amount,
      0n,
    );
    expect(sumItems).toBe(result.current.totalExposure);
  });
});
