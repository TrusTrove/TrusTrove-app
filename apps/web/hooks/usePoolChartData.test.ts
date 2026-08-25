import { renderHook } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { usePoolChartData } from "./usePoolChartData";

describe("usePoolChartData", () => {
  it("handles empty data array without errors or NaN", () => {
    const { result } = renderHook(() => usePoolChartData({ data: [] }));
    expect(result.current.linePath).toBe("");
    expect(result.current.areaPath).toBe("");
    expect(result.current.points).toEqual([]);
  });

  it("handles single snapshot dataset without dividing by zero or producing NaN", () => {
    const { result } = renderHook(() =>
      usePoolChartData({
        data: [{ label: "Day 1", value: 100 }],
        width: 500,
        height: 200,
        padding: 20,
      }),
    );

    expect(result.current.points).toHaveLength(1);
    expect(result.current.points[0].x).not.toBeNaN();
    expect(result.current.points[0].y).not.toBeNaN();
    expect(result.current.linePath).not.toContain("NaN");
    expect(result.current.areaPath).not.toContain("NaN");
  });

  it("computes correct coordinates for multiple points", () => {
    const { result } = renderHook(() =>
      usePoolChartData({
        data: [
          { label: "Day 1", value: 100 },
          { label: "Day 2", value: 200 },
        ],
        width: 500,
        height: 200,
        padding: 20,
      }),
    );

    expect(result.current.points).toHaveLength(2);
    expect(result.current.points[0].x).not.toBeNaN();
    expect(result.current.points[1].x).not.toBeNaN();
    expect(result.current.linePath).not.toContain("NaN");
  });
});
