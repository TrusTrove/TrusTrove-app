"use client";

import React from "react";

export function SkeletonShimmer({ className }: { className: string }) {
  return (
    <div
      className={`relative overflow-hidden bg-background-secondary rounded ${className}`}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-teal-500/10 to-transparent" />
      <style jsx>{`
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}

export function InvoiceCardSkeleton() {
  return (
    <div className="bg-card border border-border/60 rounded-lg p-5 space-y-4">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <SkeletonShimmer className="h-3.5 w-24" />
          <SkeletonShimmer className="h-4 w-32" />
        </div>
        <SkeletonShimmer className="h-6 w-16 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <SkeletonShimmer className="h-3 w-16" />
          <SkeletonShimmer className="h-5 w-24" />
        </div>
        <div className="space-y-1">
          <SkeletonShimmer className="h-3 w-16" />
          <SkeletonShimmer className="h-5 w-16" />
        </div>
      </div>
      <div className="space-y-2 border-t border-border/30 pt-3">
        <div className="flex justify-between">
          <SkeletonShimmer className="h-3.5 w-12" />
          <SkeletonShimmer className="h-3.5 w-32" />
        </div>
        <div className="flex justify-between">
          <SkeletonShimmer className="h-3.5 w-12" />
          <SkeletonShimmer className="h-3.5 w-28" />
        </div>
      </div>
      <SkeletonShimmer className="h-8 w-full" />
    </div>
  );
}

export function PoolStatsPanelSkeleton() {
  return (
    <div className="bg-card border border-border rounded-lg p-6 flex flex-col md:flex-row items-center gap-8">
      {/* Gauge skeleton */}
      <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
        <div className="w-28 h-28 rounded-full border-[8px] border-slate-900" />
        <div className="absolute flex flex-col items-center gap-1">
          <SkeletonShimmer className="h-6 w-14" />
          <SkeletonShimmer className="h-2.5 w-20" />
        </div>
      </div>

      {/* Key stats grid */}
      <div className="grid grid-cols-2 gap-6 w-full">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2">
            <SkeletonShimmer className="h-3 w-24" />
            <SkeletonShimmer className="h-5 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function InvoiceFeedSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-card/25 border border-border/40 p-3.5 rounded flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-2">
            <SkeletonShimmer className="w-5 h-5 rounded" />
            <div className="space-y-1">
              <SkeletonShimmer className="h-3.5 w-36" />
              <SkeletonShimmer className="h-3 w-24" />
            </div>
          </div>
          <div className="text-right space-y-1">
            <SkeletonShimmer className="h-3.5 w-16" />
            <SkeletonShimmer className="h-3 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function InvoiceTableSkeleton() {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-[#080c10]/40 text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest">
              <th className="px-5 py-3.5">Invoice ID</th>
              <th className="px-5 py-3.5">Buyer</th>
              <th className="px-5 py-3.5">Face Value</th>
              <th className="px-5 py-3.5">Discount</th>
              <th className="px-5 py-3.5">Due Date</th>
              <th className="px-5 py-3.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {[1, 2, 3, 4, 5].map((i) => (
              <tr key={i}>
                <td className="px-5 py-3.5">
                  <SkeletonShimmer className="h-3.5 w-28" />
                </td>
                <td className="px-5 py-3.5">
                  <SkeletonShimmer className="h-3.5 w-24" />
                </td>
                <td className="px-5 py-3.5">
                  <SkeletonShimmer className="h-3.5 w-20" />
                </td>
                <td className="px-5 py-3.5">
                  <SkeletonShimmer className="h-3.5 w-12" />
                </td>
                <td className="px-5 py-3.5">
                  <SkeletonShimmer className="h-3.5 w-16" />
                </td>
                <td className="px-5 py-3.5">
                  <SkeletonShimmer className="h-5 w-14 rounded-full" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function LPPositionCardSkeleton() {
  return (
    <div className="bg-[#0d131a] border border-border rounded-lg p-5 space-y-4">
      <div className="flex items-center gap-1.5 border-b border-border/40 pb-2">
        <SkeletonShimmer className="w-3.5 h-3.5 rounded" />
        <SkeletonShimmer className="h-3 w-28" />
      </div>
      <div className="space-y-4">
        <div>
          <SkeletonShimmer className="h-3 w-24 mb-1.5" />
          <SkeletonShimmer className="h-6 w-40" />
        </div>
        <div className="grid grid-cols-2 gap-4 border-t border-border/30 pt-3">
          <div>
            <SkeletonShimmer className="h-3 w-28 mb-1.5" />
            <SkeletonShimmer className="h-4 w-20" />
          </div>
          <div>
            <SkeletonShimmer className="h-3 w-20 mb-1.5" />
            <SkeletonShimmer className="h-4 w-16" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ActivityTimelineSkeleton() {
  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-4">
      <div className="border-b border-border/40 pb-2">
        <SkeletonShimmer className="h-3 w-44" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex justify-between items-start gap-4 p-2 border-b border-border/20 last:border-0"
          >
            <div className="space-y-1.5 flex-1">
              <SkeletonShimmer className="h-3 w-32" />
              <SkeletonShimmer className="h-2.5 w-56" />
            </div>
            <SkeletonShimmer className="h-2.5 w-16 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
