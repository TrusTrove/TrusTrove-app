import { SkeletonShimmer, PoolStatsPanelSkeleton, LPPositionCardSkeleton } from "@/components/shared/SkeletonLoader";

export default function LPLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 py-4">
      <SkeletonShimmer className="h-8 w-64" />
      <SkeletonShimmer className="h-4 w-96" />

      <PoolStatsPanelSkeleton />

      <LPPositionCardSkeleton />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-lg border border-border bg-card p-6">
          <SkeletonShimmer className="h-4 w-40" />
          <SkeletonShimmer className="h-3 w-32" />
          <SkeletonShimmer className="h-10 w-full" />
          <SkeletonShimmer className="h-8 w-full" />
          <SkeletonShimmer className="h-10 w-full rounded" />
        </div>
        <div className="space-y-4 rounded-lg border border-border bg-card p-6">
          <SkeletonShimmer className="h-4 w-40" />
          <SkeletonShimmer className="h-3 w-32" />
          <SkeletonShimmer className="h-10 w-full" />
          <SkeletonShimmer className="h-8 w-full" />
          <SkeletonShimmer className="h-10 w-full rounded" />
        </div>
      </div>
    </div>
  );
}
