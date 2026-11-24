"use client";

import React, { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useIssuerConcentration, type Invoice } from "../../hooks/usePoolChartData";
import { SkeletonShimmer } from "./SkeletonLoader";

export interface IssuerConcentrationChartProps {
  /** Pre-filtered or raw invoices; when omitted or combined with useInvoices, computes concentration. */
  invoices?: Invoice[];
  /** Force the loading state. */
  isLoading?: boolean;
  /** Fetch/render error to surface gracefully. */
  error?: unknown;
  /** Optional heading override. */
  title?: string;
  /** Max top issuers before grouping into Other (default 4). */
  topLimit?: number;
}

const COLORS = [
  "#14b8a6", // teal-500
  "#3b82f6", // blue-500
  "#6366f1", // indigo-500
  "#8b5cf6", // violet-500
  "#64748b", // slate-500 (Other)
];

/**
 * Reusable Issuer Concentration chart component for LPs.
 * Displays top active funded issuers and an Other bucket, reconciling totals to displayed exposure.
 */
export function IssuerConcentrationChart({
  invoices,
  isLoading = false,
  error = null,
  title = "Issuer Concentration",
  topLimit = 4,
}: IssuerConcentrationChartProps) {
  const concentration = useIssuerConcentration(invoices, topLimit);

  const chartData = useMemo(() => {
    return concentration.items.map((item) => ({
      name: item.label,
      amountUsdc: item.amountUsdc,
      percentage: item.percentage,
      issuer: item.issuer,
    }));
  }, [concentration.items]);

  if (isLoading) {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="Loading issuer concentration"
        data-testid="issuer-concentration-skeleton"
        className="bg-card border border-border/60 rounded-lg p-6 space-y-4"
      >
        <SkeletonShimmer className="h-5 w-48" />
        <SkeletonShimmer className="h-64 w-full rounded" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card border border-border/60 rounded-lg p-6 text-center text-muted-foreground">
        <p className="font-medium">Issuer concentration is temporarily unavailable.</p>
      </div>
    );
  }

  if (concentration.activeCount === 0 || chartData.length === 0) {
    return (
      <div className="bg-card border border-border/60 rounded-lg p-6 text-center text-muted-foreground">
        <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
        <p>No active funded invoices found to calculate issuer concentration.</p>
      </div>
    );
  }

  const summaryText = `Total active exposure is ${concentration.totalExposureUsdc.toLocaleString()} USDC across ${concentration.activeCount} active funded invoices. Top issuer concentration is ${chartData[0]?.percentage ?? 0} percent.`;

  return (
    <div className="bg-card border border-border/60 rounded-lg p-6 space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">
            Active funded exposure: <span className="font-mono font-medium text-foreground">${concentration.totalExposureUsdc.toLocaleString()} USDC</span> ({concentration.activeCount} invoices)
          </p>
        </div>
      </div>

      <div className="h-72 w-full" role="img" aria-label={summaryText}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
            <XAxis type="number" unit=" USDC" stroke="currentColor" opacity={0.7} />
            <YAxis type="category" dataKey="name" stroke="currentColor" opacity={0.7} width={110} />
            <Tooltip
              formatter={(value: unknown) => [
                typeof value === "number" ? `${value.toLocaleString()} USDC` : String(value),
                "Exposure",
              ]}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                borderColor: "hsl(var(--border))",
                borderRadius: "0.375rem",
              }}
            />
            <Bar dataKey="amountUsdc" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${entry.issuer}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="sr-only">
        <p>{summaryText}</p>
        <ul>
          {chartData.map((item) => (
            <li key={item.issuer}>
              {item.name}: ${item.amountUsdc.toLocaleString()} USDC ({item.percentage}%)
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
