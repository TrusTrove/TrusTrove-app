"use client";

import React from "react";
import { SkeletonShimmer } from "@/components/shared/SkeletonLoader";

export default function DocsLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="flex h-14 items-center border-b border-border/60 px-4">
        <SkeletonShimmer className="h-4 w-20 rounded" />
        <SkeletonShimmer className="h-4 w-40 rounded" />
      </div>

      <main className="flex-1 p-6">
        <div className="bg-card border border-border rounded-lg p-6 space-y-6">
          <div className="flex items-center gap-3">
            <SkeletonShimmer className="h-6 w-6 rounded-full" />
            <SkeletonShimmer className="h-3.5 w-28" />
          </div>

          <SkeletonShimmer className="h-6 w-full rounded" />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <SkeletonShimmer className="h-3 w-24" />
              <SkeletonShimmer className="h-5 w-32" />
            </div>
            <div>
              <SkeletonShimmer className="h-3 w-24" />
              <SkeletonShimmer className="h-5 w-32" />
            </div>
          </div>

          <SkeletonShimmer className="h-8 w-full" />

          <div className="flex justify-between items-start gap-3">
            <SkeletonShimmer className="h-3.5 w-12" />
            <SkeletonShimmer className="h-3.5 w-32" />
          </div>

          <SkeletonShimmer className="h-8 w-full" />
        </div>
      </main>
    </div>
  );
}
