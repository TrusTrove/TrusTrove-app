"use client";

import React, { useMemo } from "react";
import { Invoice } from "@/types";
import { formatAmount } from "@/lib/assets";

export interface AgingBucket {
  label: string;
  minDays: number;
  maxDays: number | null;
  count: number;
  faceValue: bigint;
}

export interface ReceivablesAgingProps {
  invoices?: Invoice[];
  now?: number;
  buckets?: Array<{ label: string; minDays: number; maxDays: number | null }>;
}

const DEFAULT_BUCKETS = [
  { label: "Current", minDays: 0, maxDays: 0 },
  { label: "1-30 days", minDays: 1, maxDays: 30 },
  { label: "31-60 days", minDays: 31, maxDays: 60 },
  { label: "61-90 days", minDays: 61, maxDays: 90 },
  { label: "90+ days", minDays: 91, maxDays: null },
];

export function ReceivablesAging({
  invoices = [],
  now = Math.floor(Date.now() / 1000),
  buckets = DEFAULT_BUCKETS,
}: ReceivablesAgingProps) {
  const computed = useMemo<AgingBucket[]>(() => {
    return buckets.map((bucket) => {
      let count = 0;
      let faceValue = 0n;
      for (const invoice of invoices) {
        const daysPastDue = Math.floor((now - invoice.dueDate) / 86400);
        // Age from due date; unpaid/outstanding invoices only? Keep all for counts.
        const aged = Math.max(0, daysPastDue);
        const inBucket =
          aged >= bucket.minDays &&
          (bucket.maxDays === null || aged <= bucket.maxDays);
        if (inBucket) {
          count += 1;
          faceValue += invoice.faceValue;
        }
      }
      return { ...bucket, count, faceValue };
    });
  }, [invoices, now, buckets]);

  const total = computed.reduce((acc, b) => acc + b.faceValue, 0n);

  return (
    <section
      className="rounded-lg border border-border bg-card p-4 font-mono text-xs"
      role="region"
      aria-label="Receivables Aging"
    >
      <header className="mb-4 border-b border-border/40 pb-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
          Receivables Aging
        </h2>
      </header>

      <div className="space-y-2">
        {computed.map((bucket) => (
          <div
            key={bucket.label}
            className="flex items-center justify-between rounded-md border border-border/40 bg-background/40 px-3 py-2"
          >
            <span className="text-foreground font-bold">{bucket.label}</span>
            <div className="flex items-center gap-4">
              <span className="text-muted-foreground">
                {bucket.count} invoice{bucket.count === 1 ? "" : "s"}
              </span>
              <span className="text-primary font-bold">
                {formatAmount(bucket.faceValue, "USDC")}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 border-t border-border/40 pt-2 text-[10px] text-muted-foreground">
        Total: {formatAmount(total, "USDC")}
      </div>
    </section>
  );
}

export default ReceivablesAging;
