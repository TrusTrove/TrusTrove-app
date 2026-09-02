import { SkeletonShimmer, InvoiceTableSkeleton } from "@/components/shared/SkeletonLoader";

export default function MarketplaceLoading() {
  return (
    <div className="space-y-8 py-4">
      <div className="border-b border-border/40 pb-5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-2">
            <SkeletonShimmer className="h-6 w-72" />
            <SkeletonShimmer className="h-3.5 w-96 max-w-full" />
          </div>
          <SkeletonShimmer className="h-10 w-40 rounded" />
        </div>
      </div>

      <div className="bg-[#0d131a] border border-border rounded-lg p-4 grid grid-cols-1 md:grid-cols-4 gap-4 font-mono text-xs items-end">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-1">
            <SkeletonShimmer className="h-3 w-20" />
            <SkeletonShimmer className="h-10 w-full" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-4">
          <SkeletonShimmer className="h-4 w-56" />
          <InvoiceTableSkeleton />
          <div className="md:hidden space-y-4">
            {[1, 2, 3].map((i) => (
              <SkeletonCardSkeleton key={i} />
            ))}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <SkeletonShimmer className="h-4 w-56" />
          <div className="bg-card border border-border rounded-lg p-6 space-y-4 min-h-[300px]">
            <SkeletonShimmer className="h-6 w-48" />
            {[1, 2, 3].map((i) => (
              <SkeletonShimmer key={i} className="h-6 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SkeletonCardSkeleton() {
  return (
    <div className="bg-card/25 border border-border/40 p-3.5 rounded flex items-center justify-between gap-4">
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
  );
}
