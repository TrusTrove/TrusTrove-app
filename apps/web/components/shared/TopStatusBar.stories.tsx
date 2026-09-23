import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";

import { mockRecentEvents } from "../../.storybook/mockData";
import { eventSeeds, withStoryProviders } from "../../.storybook/decorators";

import { TopStatusBar } from "./TopStatusBar";

/** The limit `TopStatusBar` passes to `useRecentEvents`. */
const TICKER_LIMIT = 20;

/**
 * The network status strip with the scrolling activity ticker. The stories seed
 * the events query so the ticker renders real (fake) rows without polling.
 */
const meta = {
  title: "Shared/TopStatusBar",
  component: TopStatusBar,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof TopStatusBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Ticker populated from recent events. */
export const WithActivity: Story = {
  decorators: [
    withStoryProviders({
      query: eventSeeds(mockRecentEvents(5), TICKER_LIMIT),
    }),
  ],
};

/** Awaiting data: the ticker falls back to placeholder rows. */
export const AwaitingActivity: Story = {
  decorators: [
    withStoryProviders({ query: eventSeeds([], TICKER_LIMIT) }),
  ],
};

/** Loading: the strip renders its network badge without event rows yet. */
export const Loading: Story = {
  decorators: [
    withStoryProviders({ pending: [["recentEvents", TICKER_LIMIT]] }),
  ],
};

/** The ticker pauses when the pause control is pressed. */
export const Paused: Story = {
  decorators: [
    withStoryProviders({
      query: eventSeeds(mockRecentEvents(5), TICKER_LIMIT),
    }),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByLabelText(/pause ticker/i));

    await expect(
      canvas.getByLabelText(/play ticker/i),
    ).toBeInTheDocument();
  },
};
