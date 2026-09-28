import { SkeletonShimmer } from "@/components/shared/SkeletonLoader";

export default function ProfileLoading() {
  return (
    <div className="space-y-8 py-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="border-b border-border/40 pb-5 space-y-2">
        <SkeletonShimmer className="h-6 w-72" />
        <SkeletonShimmer className="h-3.5 w-96 max-w-full" />
      </div>

      {/* Content card */}
      <div className="bg-card border border-border rounded-lg p-6 md:p-8 space-y-6">
        <div className="flex items-start gap-4">
          <SkeletonShimmer className="w-14 h-14 rounded-lg shrink-0" />
          <div className="space-y-2 flex-1">
            <SkeletonShimmer className="h-4 w-40" />
            <SkeletonShimmer className="h-5 w-64" />
            <SkeletonShimmer className="h-3.5 w-full max-w-xl" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-border/40">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <SkeletonShimmer className="h-3 w-24" />
              <SkeletonShimmer className="h-4 w-40" />
            </div>
          ))}
        </div>

        <SkeletonShimmer className="h-10 w-full" />
      </div>
    </div>
  );
}
