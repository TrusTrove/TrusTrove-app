"use client";

import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getInvoices } from "@/lib/api";
import type { Invoice } from "@/types";
import { SkeletonShimmer } from "./SkeletonLoader";

const STROOPS_PER_USDC = 10_000_000;

export interface BuyerConcentrationChartProps {
  /** Pre-loaded invoices. When omitted, fetches via getInvoices(). */
  invoices?: Invoice[];
  /** Force the loading state. */
  isLoading?: boolean;
  /** Fetch/render error to surface gracefully. */
  error?: unknown;
  /** Optional heading override. */
  title?: string;
}

interface BuyerConcentrationPoint {
  buyer: string;
  fundedUsdc: number;
  percentage: number;
}

export function BuyerConcentrationChart({
  invoices: invoicesProp,
  isLoading: isLoadingProp = false,
  error: errorProp = null,
  title = "Buyer Concentration",
}: BuyerConcentrationChartProps) {
  const invoicesQuery = useQuery({
    queryKey: ["invoices", "buyerConcentration"],
    queryFn: () => getInvoices(),
    enabled: invoicesProp === undefined,
    staleTime: 60000,
    retry: 2,
  });

  const rawInvoicesData = invoicesProp ?? invoicesQuery.data ?? [];
  const invoices = useMemo(
    () =>
      Array.isArray(rawInvoicesData)
        ? rawInvoicesData
        : ((rawInvoicesData as any)?.invoices ?? []),
    [rawInvoicesData],
  );
  const queryLoading = invoicesProp === undefined && invoicesQuery.isLoading;
  const queryError = invoicesProp === undefined ? invoicesQuery.error : null;
  const isLoading = isLoadingProp || queryLoading;
  const error = errorProp ?? queryError;

  const { points, totalFunded } = useMemo(() => {
    const map = new Map<string, bigint>();
    let grandTotal = 0n;

    for (const inv of invoices) {
      if (inv.fundedAmount == null || BigInt(inv.fundedAmount) === 0n) continue;
      const buyerKey =
        inv.buyer && inv.buyer.trim() !== "" ? inv.buyer : undefined;
      if (!buyerKey) continue;

      const amt = BigInt(inv.fundedAmount);
      grandTotal += amt;
      map.set(buyerKey, (map.get(buyerKey) ?? 0n) + amt);
    }

    const sorted = Array.from(map.entries())
      .map(([buyer, total]) => ({
        buyer,
        fundedUsdc: Number(total) / STROOPS_PER_USDC,
        rawTotal: total,
      }))
      .sort((a, b) => b.fundedUsdc - a.fundedUsdc);

    const totalNum = Number(grandTotal) / STROOPS_PER_USDC;

    const pts: BuyerConcentrationPoint[] = sorted.map((item) => ({
      buyer: `${item.buyer.slice(0, 4)}...${item.buyer.slice(-4)}`,
      fundedUsdc: item.fundedUsdc,
      percentage: totalNum > 0 ? (item.fundedUsdc / totalNum) * 100 : 0,
    }));

    return { points: pts, totalFunded: totalNum };
  }, [invoices]);

  const hasMissingIdentity = useMemo(() => {
    return invoices.some(
      (inv: Invoice) =>
        inv.fundedAmount != null &&
        BigInt(inv.fundedAmount) !== 0n &&
        (!inv.buyer || inv.buyer.trim() === ""),
    );
  }, [invoices]);

  if (error) {
    return (
      <section aria-label={`${title} (error)`}>
        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
          {title}
        </h2>
        <p className="mt-3 rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Buyer exposure data is temporarily unavailable. Please try again
          later.
        </p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section aria-label={`${title} (loading)`}>
        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
          {title}
        </h2>
        <div
          className="mt-3 space-y-2"
          data-testid="buyer-concentration-skeleton"
        >
          <SkeletonShimmer className="h-4 w-40" />
          <SkeletonShimmer className="h-64 w-full" />
        </div>
      </section>
    );
  }

  if (points.length === 0) {
    return (
      <section aria-label={`${title} (empty)`}>
        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
          {title}
        </h2>
        <p className="mt-3 rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No funded buyer exposure recorded yet. Concentration metrics will
          appear here once invoices are funded.
        </p>
      </section>
    );
  }

  return (
    <section aria-label={title}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
          {title}
        </h2>
        <span className="text-xs font-mono text-muted-foreground">
          Total Funded:{" "}
          {totalFunded.toLocaleString("en-US", { maximumFractionDigits: 2 })}{" "}
          USDC
        </span>
      </div>
      {hasMissingIdentity && (
        <div
          className="mt-2 rounded-md border border-amber-500/40 bg-amber-950/10 p-3 text-xs text-amber-400"
          role="alert"
        >
          Notice: Some funded exposure lacks complete buyer identity data and is
          excluded from concentration totals.
        </div>
      )}
      <div
        className="mt-3 rounded-lg border border-border bg-card p-4"
        role="img"
        aria-label={`${title} chart showing funded exposure per buyer with exact totals and percentage denominator.`}
      >
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={points}
            margin={{ top: 8, right: 8, bottom: 24, left: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="buyer"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              interval={0}
              angle={-20}
              textAnchor="end"
            />
            <YAxis
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              tickFormatter={(v: number) => `${v} USDC`}
              width={70}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                color: "hsl(var(--card-foreground))",
                fontSize: "12px",
              }}
              formatter={(value, _name, item) => {
                const valNum =
                  typeof value === "number" ? value : Number(value) || 0;
                const pct =
                  (item as { payload?: BuyerConcentrationPoint })?.payload
                    ?.percentage ?? 0;
                return [
                  `${valNum.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDC (${pct.toFixed(1)}% of total)`,
                  "Funded Exposure",
                ];
              }}
            />
            <Bar
              dataKey="fundedUsdc"
              fill="hsl(var(--primary, 172 66% 50%))"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
