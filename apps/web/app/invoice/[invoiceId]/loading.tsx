"use client";

import { SkeletonShimmer } from "@/components/shared/SkeletonLoader";
import { PageLayout } from "@/components/shared/PageLayout";

export default function InvoiceLoading() {
  return (
    <PageLayout>
      <div className="space-y-6 py-4">
        <div className="flex flex-col items-center justify-center py-20 min-h-[50vh]">
          <div className="space-y-4 max-w-md w-full">
            <SkeletonShimmer className="h-6 w-32 rounded" />
            <SkeletonShimmer className="h-6 w-48 rounded" />
            <SkeletonShimmer className="h-6 w-64 rounded" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl w-full">
            {[1, 2].map((i) => (
              <SkeletonShimmer
                key={i}
                className="bg-card border border-border/40 rounded-lg p-4"
              />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 max-w-2xl w-full">
            {[1, 2, 3, 4].map((i) => (
              <SkeletonShimmer key={i} className="h-6 w-full" />
            ))}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
