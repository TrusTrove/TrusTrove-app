import { SkeletonShimmer } from "@/components/shared/SkeletonLoader";

export default function DashboardLoading() {
  return (
    <div className="space-y-8 py-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/40 pb-5">
        <div className="space-y-2">
          <SkeletonShimmer className="h-6 w-72" />
          <SkeletonShimmer className="h-3.5 w-96 max-w-full" />
        </div>
        <SkeletonShimmer className="h-10 w-40 rounded" />
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="bg-card border border-border rounded-lg p-4 space-y-2"
          >
            <SkeletonShimmer className="h-3 w-24" />
            <SkeletonShimmer className="h-5 w-16" />
            <SkeletonShimmer className="h-2.5 w-20" />
          </div>
        ))}
      </div>

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Invoices Section */}
        <div className="lg:col-span-8 space-y-6">
          <SkeletonShimmer className="h-4 w-40" />

          {/* Invoice table skeleton */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-[#080c10]/40">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <th key={i} className="px-5 py-3.5">
                        <SkeletonShimmer className="h-3 w-16" />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <tr key={i}>
                      {[1, 2, 3, 4, 5, 6].map((j) => (
                        <td key={j} className="px-5 py-3.5">
                          <SkeletonShimmer className="h-3.5 w-20" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Activity timeline skeleton */}
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
        </div>

        {/* Side Management Panel */}
        <div className="lg:col-span-4 space-y-6">
          <SkeletonShimmer className="h-4 w-40" />
          <div className="bg-card/45 border border-dashed border-border rounded-lg p-6 py-20">
            <div className="space-y-3">
              <SkeletonShimmer className="h-3 w-48 mx-auto" />
              <SkeletonShimmer className="h-3 w-64 mx-auto" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
