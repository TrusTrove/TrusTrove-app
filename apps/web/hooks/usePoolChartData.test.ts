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

describe("calculateMaturityDistribution", () => {
  const now = 1700000000;

  it("groups active funded principal into due-date bands and overdue band summing to active exposure", () => {
    const invoices = [
      {
        id: "1",
        fundedAmount: "1000000000" as const,
        dueDate: now + 10 * 86400,
        status: "Funded",
      },
      {
        id: "2",
        fundedAmount: "2000000000" as const,
        dueDate: now + 40 * 86400,
        status: "Funded",
      },
      {
        id: "3",
        fundedAmount: "3000000000" as const,
        dueDate: now + 70 * 86400,
        status: "Funded",
      },
      {
        id: "4",
        fundedAmount: "4000000000" as const,
        dueDate: now + 100 * 86400,
        status: "Funded",
      },
      {
        id: "5",
        fundedAmount: "5000000000" as const,
        dueDate: now - 5 * 86400,
        status: "Funded",
      },
      {
        id: "6",
        fundedAmount: "999999900000" as const,
        dueDate: now + 5 * 86400,
        status: "Repaid",
      },
    ];

    const distribution = calculateMaturityDistribution(invoices, now);

    const totalAmount = distribution.reduce(
      (acc: number, b: { amount: number }) => acc + b.amount,
      0,
    );
    expect(totalAmount).toBe(1500); // 100 + 200 + 300 + 400 + 500 = 1500 USDC

    const bandMap = Object.fromEntries(
      distribution.map(
        (b: { band: string; amount: number; percentage: number }) => [
          b.band,
          b,
        ],
      ),
    );

    expect(bandMap["0-30d"].amount).toBe(100);
    expect(bandMap["31-60d"].amount).toBe(200);
    expect(bandMap["61-90d"].amount).toBe(300);
    expect(bandMap["90d+"].amount).toBe(400);
    expect(bandMap["Overdue"].amount).toBe(500);

    expect(bandMap["0-30d"].percentage).toBeCloseTo((100 / 1500) * 100);
    expect(bandMap["Overdue"].percentage).toBeCloseTo((500 / 1500) * 100);
  });

  it("handles empty and permission boundary / invalid inputs gracefully", () => {
    const distribution = calculateMaturityDistribution([], now);

    expect(distribution).toHaveLength(5);
    distribution.forEach((b: { amount: number; percentage: number }) => {
      expect(b.amount).toBe(0);
      expect(b.percentage).toBe(0);
    });
  });
});
