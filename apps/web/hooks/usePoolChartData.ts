import { useMemo } from "react";

export interface ChartDataItem {
  label: string;
  value: number;
}

export interface InvoiceMaturityItem {
  id: string;
  fundedAmount: string | bigint;
  dueDate: number; // Unix timestamp in seconds
  status?: string;
}

export interface MaturityDistributionBand {
  band: string;
  amount: number;
  percentage: number;
}

const STROOPS_PER_USDC = 10_000_000;

export function calculateMaturityDistribution(
  invoices: InvoiceMaturityItem[],
  nowSeconds: number = Math.floor(Date.now() / 1000),
): MaturityDistributionBand[] {
  const bands = [
    { band: "0-30d", min: 0, max: 30 },
    { band: "31-60d", min: 31, max: 60 },
    { band: "61-90d", min: 61, max: 90 },
    { band: "90d+", min: 91, max: Infinity },
    { band: "Overdue", min: -Infinity, max: -1 },
  ];

  const totals: Record<string, number> = {
    "0-30d": 0,
    "31-60d": 0,
    "61-90d": 0,
    "90d+": 0,
    Overdue: 0,
  };

  let totalActive = 0;

  for (const inv of invoices as InvoiceMaturityItem[]) {
    if (inv.status && (inv.status === "Repaid" || inv.status === "Defaulted")) {
      continue;
    }
    const rawAmt =
      typeof inv.fundedAmount === "bigint"
        ? Number(inv.fundedAmount)
        : Number(BigInt(String(inv.fundedAmount || "0")));
    if (!Number.isFinite(rawAmt) || rawAmt <= 0) continue;
    const usdcAmt = rawAmt / STROOPS_PER_USDC;
    totalActive += usdcAmt;

    const diffDays = Math.floor((inv.dueDate - nowSeconds) / 86400);

    if (diffDays < 0) {
      totals["Overdue"] += usdcAmt;
    } else if (diffDays <= 30) {
      totals["0-30d"] += usdcAmt;
    } else if (diffDays <= 60) {
      totals["31-60d"] += usdcAmt;
    } else if (diffDays <= 90) {
      totals["61-90d"] += usdcAmt;
    } else {
      totals["90d+"] += usdcAmt;
    }
  }

  return bands.map((b) => {
    const amount = totals[b.band] || 0;
    const percentage = totalActive > 0 ? (amount / totalActive) * 100 : 0;
    return {
      band: b.band,
      amount,
      percentage,
    };
  });
}

export interface UsePoolChartDataOptions {
  data: ChartDataItem[];
  width?: number;
  height?: number;
  padding?: number;
}

/**
 * Custom hook that transforms raw label/value data into SVG-ready chart geometry.
 *
 * Computes the SVG `d` attribute strings for both a line path and a filled
 * area path, as well as the mapped coordinate points. Designed for use with
 * an inline SVG `<path>` element.
 *
 * @param options - Chart configuration.
 * @param options.data - Array of `{ label, value }` entries to plot.
 * @param options.width - SVG viewport width in pixels (default `500`).
 * @param options.height - SVG viewport height in pixels (default `200`).
 * @param options.padding - Inset padding around the chart area (default `20`).
 *
 * @returns An object containing:
 *   - `linePath` — SVG path `d` string tracing the data as a continuous line.
 *   - `areaPath` — SVG path `d` string closing the line down to the baseline for a filled region.
 *   - `points` — Array of `{ x, y, label, value }` objects with mapped canvas coordinates.
 */
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

    // When there is only one data point, place it at the center of the chart
    // to avoid division by zero (index / (data.length - 1)).
    if (data.length === 1) {
      const x = padding + chartWidth / 2;
      const y =
        padding +
        chartHeight -
        ((data[0].value - minVal) / valRange) * chartHeight;
      const points = [{ x, y, label: data[0].label, value: data[0].value }];
      const linePath = `M ${x} ${y}`;
      const areaPath = `${linePath} L ${x} ${height - padding} L ${x} ${height - padding} Z`;
      return { linePath, areaPath, points };
    }

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
