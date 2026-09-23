import type { Meta, StoryObj } from "@storybook/react";

import { mockRecentEvents } from "../../.storybook/mockData";
import { eventSeeds, withStoryProviders } from "../../.storybook/decorators";

import { InvoiceFeed } from "./InvoiceFeed";

/** The number `InvoiceFeed` passes to `useRecentEvents`. */
const FEED_LIMIT = 6;

/**
 * The live on-chain activity feed. It polls `useRecentEvents`, so the stories
 * seed that query instead of polling: a loaded feed, a permanently-pending feed
 * (the skeleton state), and an empty feed.
 */
const meta = {
  title: "Shared/InvoiceFeed",
  component: InvoiceFeed,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div className="w-[420px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InvoiceFeed>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A feed populated with one entry per event type. */
export const WithActivity: Story = {
  decorators: [
    withStoryProviders({
      query: eventSeeds(mockRecentEvents(FEED_LIMIT), FEED_LIMIT),
    }),
  ],
};

/** Still loading: the feed skeleton is shown. */
export const Loading: Story = {
  decorators: [
    withStoryProviders({ pending: [["recentEvents", FEED_LIMIT]] }),
  ],
};

/** No events yet: the "awaiting on-chain activity" placeholder. */
export const Empty: Story = {
  decorators: [
    withStoryProviders({ query: eventSeeds([], FEED_LIMIT) }),
  ],
};
