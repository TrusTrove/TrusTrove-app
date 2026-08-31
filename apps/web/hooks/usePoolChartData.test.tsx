import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";

import { usePoolChartData, type ChartDataItem } from "./usePoolChartData";

function makeData(values: { label: string; value: number }[]): ChartDataItem[] {
  return values;
}

describe("usePoolChartData", () => {
  /**
   * Happy path – given a valid data array the hook produces SVG line/area
   * paths and a correctly-mapped array of canvas-space points.
   */
  it("returns formatted chart layout on valid data", () => {
    const data = makeData([
      { label: "Available", value: 600_000 },
      { label: "Utilised", value: 400_000 },
    ]);

    const { result } = renderHook(() =>
      usePoolChartData({ data, width: 500, height: 200 }),
    );

    // Line and area paths should be non-empty SVG strings
    expect(result.current.linePath).toContain("M ");
    expect(result.current.areaPath).toContain("M ");
    expect(result.current.areaPath).toContain("Z");

    // Points array should match input length
    expect(result.current.points).toHaveLength(2);

    // First point should be at left padding (x = 20), mapped to higher Y (larger value)
    expect(result.current.points[0].x).toBe(20); // padding
    expect(result.current.points[0].label).toBe("Available");
    expect(result.current.points[0].value).toBe(600_000);

    // Second point should be at right side
    expect(result.current.points[1].label).toBe("Utilised");
    expect(result.current.points[1].value).toBe(400_000);
  });

  /**
   * Edge case – empty data produces empty paths and no points.
   */
  it("returns empty layout for empty data", () => {
    const { result } = renderHook(() =>
      usePoolChartData({ data: [], width: 500, height: 200 }),
    );

    expect(result.current.linePath).toBe("");
    expect(result.current.areaPath).toBe("");
    expect(result.current.points).toHaveLength(0);
  });

  /**
   * Edge case – all values are zero (brand-new pool).
   * The hook should still produce valid SVG paths without crashing.
   */
  it("handles zero values gracefully", () => {
    const data = makeData([
      { label: "Deposits", value: 0 },
      { label: "Funded", value: 0 },
    ]);

    const { result } = renderHook(() =>
      usePoolChartData({ data, width: 500, height: 200 }),
    );

    expect(result.current.linePath).toContain("M ");
    expect(result.current.areaPath).toContain("Z");
    expect(result.current.points).toHaveLength(2);

    for (const point of result.current.points) {
      expect(point.value).toBe(0);
    }
  });

  /**
   * Uses default dimensions when width/height/padding are omitted.
   */
  it("applies default dimensions when not provided", () => {
    const data = makeData([
      { label: "A", value: 10 },
      { label: "B", value: 20 },
      { label: "C", value: 15 },
    ]);

    const { result } = renderHook(() => usePoolChartData({ data }));

    expect(result.current.points).toHaveLength(3);

    // With defaults: width=500, height=200, padding=20
    // First point x = padding = 20
    expect(result.current.points[0].x).toBe(20);
    // Last point x = padding + chartWidth = 20 + (500 - 40) = 480
    expect(result.current.points[2].x).toBe(480);
  });

  /**
   * Error path – single data point should not crash
   * (division by zero in index / (length - 1)).
   */
  it("handles a single data point", () => {
    const data = makeData([{ label: "Only", value: 42 }]);

    const { result } = renderHook(() =>
      usePoolChartData({ data, width: 500, height: 200 }),
    );

    expect(result.current.points).toHaveLength(1);
    expect(result.current.points[0].value).toBe(42);
    // Single point path is just a move command, no line
    expect(result.current.linePath).toContain("M ");
  });
});
