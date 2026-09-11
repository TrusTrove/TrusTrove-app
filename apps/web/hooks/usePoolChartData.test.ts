import { renderHook } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { usePoolChartData } from "./usePoolChartData";

describe("usePoolChartData", () => {
  it("handles empty data gracefully", () => {
    const { result } = renderHook(() => usePoolChartData({ data: [] }));
    expect(result.current.linePath).toBe("");
    expect(result.current.areaPath).toBe("");
    expect(result.current.points).toEqual([]);
  });

  it("handles single data point without division by zero or NaN", () => {
    const { result } = renderHook(() =>
      usePoolChartData({
        data: [{ label: "Snapshot 1", value: 100 }],
        width: 500,
        height: 200,
        padding: 20,
      })
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
          { label: "A", value: 10 },
          { label: "B", value: 20 },
        ],
        width: 100,
        height: 100,
        padding: 10,
      })
    );

    expect(result.current.points).toHaveLength(2);
    expect(result.current.points[0].x).toBe(10);
    expect(result.current.points[1].x).toBe(90);
    expect(result.current.linePath).not.toContain("NaN");
  });
});
