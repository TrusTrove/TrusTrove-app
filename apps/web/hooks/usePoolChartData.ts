import { useMemo } from "react";

export interface ChartDataItem {
  label: string;
  value: number;
}

export interface UsePoolChartDataOptions {
  data: ChartDataItem[];
  width?: number;
  height?: number;
  padding?: number;
}

export function usePoolChartData({
  data,
  width = 500,
  height = 200,
  padding = 20,
}: UsePoolChartDataOptions) {
  const chartLayout = useMemo(() => {
    if (!data || data.length === 0) {
      return { linePath: "", areaPath: "", points: [] };
    }

    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const values = data.map((d) => d.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const valRange = maxVal - minVal === 0 ? 1 : maxVal - minVal;

    // Map raw data entries into X, Y canvas space coordinate arrays
    const points = data.map((item, index) => {
      const x = padding + (index / (data.length - 1)) * chartWidth;
      const y =
        padding +
        chartHeight -
        ((item.value - minVal) / valRange) * chartHeight;
      return { x, y, label: item.label, value: item.value };
    });

    // Generate the SVG continuous Bezier line commands
    const linePath = points.reduce((acc, pt, i) => {
      return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
    }, "");

    // Close the SVG region loop down to the bottom baseline boundary to create a filled shaded area
    const areaPath =
      points.length > 0
        ? `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`
        : "";

    return {
      linePath,
      areaPath,
      points,
    };
  }, [data, width, height, padding]);

  return chartLayout;
}
