import { SkeletonShimmer } from "@/components/shared/SkeletonLoader";

export default function Loading() {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="space-y-2">
        <SkeletonShimmer className="h-8 w-48" />
        <SkeletonShimmer className="h-4 w-72" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-card border border-border/60 rounded-lg p-5 space-y-3"
          >
            <SkeletonShimmer className="h-3 w-20" />
            <SkeletonShimmer className="h-6 w-24" />
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-card border border-border/60 rounded-lg p-5 space-y-4"
            >
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
              <SkeletonShimmer className="h-8 w-full" />
            </div>
          ))}
        </div>

        {/* Activity timeline */}
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
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
      </div>
    </div>
  );
}
