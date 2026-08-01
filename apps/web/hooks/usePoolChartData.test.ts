import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePoolChartData } from "./usePoolChartData";

describe("usePoolChartData", () => {
  it("returns empty chart paths when there is no data", () => {
    const { result } = renderHook(() => usePoolChartData({ data: [] }));

    expect(result.current).toEqual({
      linePath: "",
      areaPath: "",
      points: [],
    });
  });

  it("centers a single snapshot without producing NaN coordinates", () => {
    const { result } = renderHook(() =>
      usePoolChartData({
        data: [{ label: "Snapshot 1", value: 100 }],
        width: 500,
        height: 200,
        padding: 20,
      }),
    );

    const { points, linePath, areaPath } = result.current;

    expect(points).toHaveLength(1);
    expect(points[0]).toEqual({
      x: 250,
      y: 180,
      label: "Snapshot 1",
      value: 100,
    });
    expect(linePath).toBe("M 246 180 L 254 180");
    expect(linePath).not.toContain("NaN");
    expect(areaPath).not.toContain("NaN");
  });
});
