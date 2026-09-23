import type { Meta, StoryObj } from "@storybook/react";

import {
  ActivityTimelineSkeleton,
  InvoiceCardSkeleton,
  InvoiceFeedSkeleton,
  InvoiceTableSkeleton,
  LPPositionCardSkeleton,
  PoolStatsPanelSkeleton,
  SkeletonShimmer,
} from "./SkeletonLoader";

/**
 * The loading placeholders used while a query is in flight. Each export mirrors
 * the layout of the component it stands in for, so they are storied one-to-one;
 * these are the "loading state" visuals for the data-driven screens.
 */
const meta = {
  title: "Shared/Skeleton Loaders",
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** The base shimmer primitive. */
export const Shimmer: Story = {
  render: () => (
    <div className="w-64 space-y-3">
      <SkeletonShimmer className="h-4 w-full" />
      <SkeletonShimmer className="h-4 w-2/3" />
      <SkeletonShimmer className="h-8 w-1/3 rounded-full" />
    </div>
  ),
};

/** Stand-in for a single `InvoiceCard`. */
export const InvoiceCard: Story = {
  render: () => (
    <div className="w-[420px]">
      <InvoiceCardSkeleton />
    </div>
  ),
};

/** Stand-in for the pool stats panel (gauge + four metrics). */
export const PoolStatsPanel: Story = {
  render: () => <PoolStatsPanelSkeleton />,
};

/** Stand-in for the live financing feed. */
export const InvoiceFeed: Story = {
  render: () => (
    <div className="h-[340px] rounded-lg border border-border bg-[#0d131a] p-4">
      <InvoiceFeedSkeleton />
    </div>
  ),
};

/** Stand-in for the virtualized invoice ledger. */
export const InvoiceTable: Story = {
  render: () => <InvoiceTableSkeleton />,
};

/** Stand-in for an LP position card. */
export const LpPositionCard: Story = {
  render: () => (
    <div className="w-[380px]">
      <LPPositionCardSkeleton />
    </div>
  ),
};

/** Stand-in for the activity timeline. */
export const ActivityTimeline: Story = {
  render: () => <ActivityTimelineSkeleton />,
};
