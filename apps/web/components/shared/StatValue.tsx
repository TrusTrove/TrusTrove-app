import { SkeletonShimmer } from "./SkeletonLoader";

interface StatValueProps {
  /** Pre-formatted value, or `null` when there is nothing to show. */
  value: string | null;
  isLoading?: boolean;
  error?: unknown;
}

/**
 * The landing page's shared stat renderer: skeleton while loading, an em dash
 * when the indexer is unreachable, the value otherwise. Kept markup-identical
 * to the copy `HomeClient` rendered inline (#996).
 */
export function StatValue({ value, isLoading, error }: StatValueProps) {
  if (isLoading) {
    return <SkeletonShimmer className="h-7 w-20 mx-auto lg:mx-0" />;
  }

  const errorMessage =
    error instanceof Error
      ? error.message
      : error == null
        ? null
        : "An unexpected error occurred.";
  if (errorMessage !== null || value === null) {
    return (
      <span className="text-xl sm:text-2xl font-bold font-mono text-muted-foreground block">
        —
      </span>
    );
  }
  return (
    <span className="text-xl sm:text-2xl font-bold font-mono text-foreground block">
      {value}
    </span>
  );
}
