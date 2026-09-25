"use client";

import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getPoolSnapshots } from "@/lib/api";
import type { PoolSnapshot } from "@/types";
import { SkeletonShimmer } from "./SkeletonLoader";

const STROOPS_PER_USDC = 10_000_000;

export interface PoolPerformanceChartProps {
  /** Pre-loaded snapshots. When omitted, the chart fetches via getPoolSnapshots(). */
  snapshots?: PoolSnapshot[];
  /** Force the loading state (e.g. when the parent is still fetching). */
  isLoading?: boolean;
  /** Fetch/render error to surface gracefully instead of the chart. */
  error?: unknown;
  /** Optional heading override. */
  title?: string;
}

interface ChartPoint {
  date: string;
  utilizationPct: number;
  yieldUsdc: number;
}

function toMillis(ts: number): number {
  // Snapshots may carry seconds or milliseconds; normalize defensively.
  return ts > 1e12 ? ts : ts * 1000;
}

export function formatSnapshotPoint(snapshot: PoolSnapshot): ChartPoint {
  const yieldRaw = Number(snapshot.totalYieldDistributed);
  return {
    date: new Date(toMillis(snapshot.timestamp)).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    utilizationPct: snapshot.utilizationRateBps / 100,
    yieldUsdc: Number.isFinite(yieldRaw) ? yieldRaw / STROOPS_PER_USDC : 0,
  };
}

/**
 * Reusable pool performance chart rendering utilization rate and cumulative
 * yield over time from indexer pool snapshots.
 *
 * Data can be supplied via `snapshots` or fetched internally with
 * `getPoolSnapshots()`. Loading uses the shared skeleton pattern, and empty
 * / error states render graceful fallbacks. A visually-hidden text summary
 * keeps the trend accessible to screen readers.
 */
export function PoolPerformanceChart({
  snapshots: snapshotsProp,
  isLoading: isLoadingProp = false,
  error: errorProp = null,
  title = "Pool Performance",
}: PoolPerformanceChartProps) {
  const snapshotsQuery = useQuery({
    queryKey: ["poolSnapshots"],
    queryFn: () => getPoolSnapshots(),
    enabled: snapshotsProp === undefined,
    staleTime: 60000,
    retry: 2,
  });

  const snapshots = useMemo(
    () => snapshotsProp ?? snapshotsQuery.data ?? [],
    [snapshotsProp, snapshotsQuery.data],
  );
  const queryLoading = snapshotsProp === undefined && snapshotsQuery.isLoading;
  const queryError = snapshotsProp === undefined ? snapshotsQuery.error : null;
  const isLoading = isLoadingProp || queryLoading;
  // An explicitly provided error takes precedence over any background fetch.
  const error = errorProp ?? queryError;

  const points: ChartPoint[] = useMemo(
    () => snapshots.map(formatSnapshotPoint),
    [snapshots],
  );

  const summary = useMemo(() => {
    if (points.length === 0) return null;
    const first = points[0];
    const last = points[points.length - 1];
    const utilDelta = last.utilizationPct - first.utilizationPct;
    const direction =
      utilDelta > 0.005 ? "up" : utilDelta < -0.005 ? "down" : "flat";
    return (
      `Pool utilization is currently ${last.utilizationPct.toFixed(1)} percent, ` +
      `${direction} from ${first.utilizationPct.toFixed(1)} percent across ` +
      `${points.length} snapshots. Total yield distributed is ` +
      `${last.yieldUsdc.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDC.`
    );
  }, [points]);

  if (error) {
    return (
      <section aria-label={`${title} (error)`}>
        <h2 className="text-sm font-bold uppercase tracking-wider text-white">
          {title}
        </h2>
        <p className="mt-3 rounded-lg border border-border bg-card p-6 text-center text-sm text-slate-400">
          Pool history is temporarily unavailable. Please try again later.
        </p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section aria-label={`${title} (loading)`}>
        <h2 className="text-sm font-bold uppercase tracking-wider text-white">
          {title}
        </h2>
        <div className="mt-3 space-y-2" data-testid="pool-chart-skeleton">
          <SkeletonShimmer className="h-4 w-40" />
          <SkeletonShimmer className="h-64 w-full" />
        </div>
      </section>
    );
  }

  if (points.length === 0) {
    return (
      <section aria-label={`${title} (empty)`}>
        <h2 className="text-sm font-bold uppercase tracking-wider text-white">
          {title}
        </h2>
        <p className="mt-3 rounded-lg border border-border bg-card p-6 text-center text-sm text-slate-400">
          No pool snapshots yet. Performance history will appear here once the
          indexer records its first snapshot.
        </p>
      </section>
    );
  }

  return (
    <section aria-label={title}>
      <h2 className="text-sm font-bold uppercase tracking-wider text-white">
        {title}
      </h2>
      {summary !== null && (
        <p className="sr-only" aria-live="polite">
          {summary}
        </p>
      )}
      <div
        className="mt-3 rounded-lg border border-border bg-card p-4"
        role="img"
        aria-label={summary ?? `${title} chart`}
      >
        <ResponsiveContainer width="100%" height={320}>
          <LineChart
            data={points}
            margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1a2330" />
            <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} />
            <YAxis
              yAxisId="util"
              tick={{ fill: "#64748b", fontSize: 11 }}
              tickFormatter={(v: number) => `${v}%`}
              width={48}
            />
            <YAxis
              yAxisId="yield"
              orientation="right"
              tick={{ fill: "#64748b", fontSize: 11 }}
              width={56}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0d131a",
                border: "1px solid #1e293b",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value, name) => {
                if (name === "Utilization") return [`${value}%`, name];
                return [`${value} USDC`, name];
              }}
            />
            <Legend />
            <Line
              yAxisId="util"
              type="monotone"
              dataKey="utilizationPct"
              name="Utilization"
              stroke="#00d4aa"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="yield"
              type="monotone"
              dataKey="yieldUsdc"
              name="Yield distributed"
              stroke="#38bdf8"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
