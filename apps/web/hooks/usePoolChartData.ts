import { useMemo } from "react";
export type InvoiceStatus = "Created" | "Funded" | "Active" | "Repaid" | "Defaulted";

export interface Invoice {
  id: string;
  status: InvoiceStatus;
  issuer: string;
  buyer: string;
  faceValue: bigint;
  asset: string;
  discountBps: number;
  fundedAmount: bigint;
  dueDate: number;
  createdAt: number;
  fundedAt: number | null;
  shippedAt: number | null;
  issuerConfirmed: boolean;
  buyerConfirmed: boolean;
  repaidAt: number | null;
}

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
 * @param options.padding - Inset padding around the chart area (default `20` ).
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

export interface IssuerConcentrationItem {
  issuer: string;
  label: string;
  amount: bigint;
  amountUsdc: number;
  percentage: number;
}

export interface IssuerConcentrationResult {
  items: IssuerConcentrationItem[];
  totalExposure: bigint;
  totalExposureUsdc: number;
  activeCount: number;
}

const STROOPS_PER_USDC = 10_000_000;

/**
 * Hook that aggregates active funded invoices by issuer to compute issuer
 * concentration for LPs. Retains the top N issuers and groups the remaining
 * into an "Other" bucket while guaranteeing totals reconcile exactly to
 * displayed exposure.
 */
export function useIssuerConcentration(
  invoices: Invoice[] | undefined,
  topLimit: number = 4,
): IssuerConcentrationResult {
  return useMemo(() => {
    if (!invoices || invoices.length === 0) {
      return {
        items: [],
        totalExposure: 0n,
        totalExposureUsdc: 0,
        activeCount: 0,
      };
    }

    // Filter to active funded invoices (status === "Funded" or "Active" with fundedAmount > 0)
    const activeInvoices = invoices.filter(
      (inv) =>
        (inv.status === "Funded" || inv.status === "Active") &&
        inv.fundedAmount > 0n,
    );

    const totalsByIssuer = new Map<string, bigint>();
    let totalExposure = 0n;

    for (const inv of activeInvoices) {
      const current = totalsByIssuer.get(inv.issuer) ?? 0n;
      totalsByIssuer.set(inv.issuer, current + inv.fundedAmount);
      totalExposure += inv.fundedAmount;
    }

    const sortedIssuers = Array.from(totalsByIssuer.entries()).sort(
      (a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0),
    );

    const topIssuers = sortedIssuers.slice(0, topLimit);
    const remainingIssuers = sortedIssuers.slice(topLimit);

    let otherTotal = 0n;
    for (const [, amount] of remainingIssuers) {
      otherTotal += amount;
    }

    const items: IssuerConcentrationItem[] = topIssuers.map(([issuer, amount], index) => {
      const amountUsdc = Number(amount) / STROOPS_PER_USDC;
      const percentage =
        totalExposure > 0n ? Number((amount * 10000n) / totalExposure) / 100 : 0;
      const shortIssuer =
        issuer.length > 10
          ? `${issuer.slice(0, 4)}...${issuer.slice(-4)}`
          : issuer;
      return {
        issuer,
        label: `Issuer ${shortIssuer}`,
        amount,
        amountUsdc,
        percentage,
      };
    });

    if (otherTotal > 0n) {
      const amountUsdc = Number(otherTotal) / STROOPS_PER_USDC;
      const percentage =
        totalExposure > 0n ? Number((otherTotal * 10000n) / totalExposure) / 100 : 0;
      items.push({
        issuer: "other",
        label: "Other Issuers",
        amount: otherTotal,
        amountUsdc,
        percentage,
      });
    }

    const totalExposureUsdc = Number(totalExposure) / STROOPS_PER_USDC;

    return {
      items,
      totalExposure,
      totalExposureUsdc,
      activeCount: activeInvoices.length,
    };
  }, [invoices, topLimit]);
}
