"use client";

import dynamic from "next/dynamic";
import { ErrorBoundary } from "./ErrorBoundary";
import { SkeletonShimmer } from "./SkeletonLoader";

const LpYieldCalculator = dynamic(
  () => import("./LpYieldCalculator").then((m) => m.LpYieldCalculator),
  {
    ssr: false,
    loading: () => (
      <div className="bg-card border border-border rounded-lg p-5 space-y-5 shadow-[0_0_30px_rgba(0,212,170,0.02)]">
        <SkeletonShimmer className="h-4 w-32" />
        <div className="space-y-4">
          <SkeletonShimmer className="h-10 w-full" />
          <div className="space-y-2">
            <SkeletonShimmer className="h-3 w-24" />
            <SkeletonShimmer className="h-6 w-full" />
          </div>
        </div>
        <div className="bg-background border border-border/60 rounded p-4 space-y-3">
          <SkeletonShimmer className="h-3 w-40" />
          <SkeletonShimmer className="h-8 w-20" />
          <SkeletonShimmer className="h-3 w-32" />
          <SkeletonShimmer className="h-5 w-24" />
        </div>
      </div>
    ),
  },
);

const DiscountCalculator = dynamic(
  () => import("./DiscountCalculator").then((m) => m.DiscountCalculator),
  {
    ssr: false,
    loading: () => (
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="flex border-b border-border bg-background/60">
          <SkeletonShimmer className="flex-1 h-12" />
          <SkeletonShimmer className="flex-1 h-12" />
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <SkeletonShimmer className="h-4 w-48" />
              <SkeletonShimmer className="h-20 w-full" />
              <SkeletonShimmer className="h-20 w-full" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SkeletonShimmer className="h-40 w-full" />
              <SkeletonShimmer className="h-40 w-full" />
            </div>
          </div>
        </div>
      </div>
    ),
  },
);

export function HomeLpCalculator() {
  return (
    <ErrorBoundary context="LpYieldCalculator">
      <LpYieldCalculator />
    </ErrorBoundary>
  );
}

export function HomeDiscountCalculator() {
  return (
    <ErrorBoundary context="DiscountCalculator">
      <DiscountCalculator />
    </ErrorBoundary>
  );
}
