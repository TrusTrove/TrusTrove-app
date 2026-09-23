import type { Meta, StoryObj } from "@storybook/react";

import { STORY_ADDRESS, mockTxHistory } from "../../.storybook/mockData";
import { txSeeds, withStoryProviders } from "../../.storybook/decorators";

import { TxHistory } from "./TxHistory";

/**
 * Paginated transaction history from Horizon. `useTxHistory` is a react-query
 * hook, so the stories seed its cache per address rather than reaching Horizon.
 */
const meta = {
  title: "Shared/TxHistory",
  component: TxHistory,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: { address: STORY_ADDRESS },
  decorators: [
    (Story) => (
      <div className="w-[520px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TxHistory>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A page of successful and failed transactions. */
export const WithTransactions: Story = {
  decorators: [
    withStoryProviders({ query: txSeeds(mockTxHistory(4), STORY_ADDRESS) }),
  ],
};

/** Every row failed, so the failure styling is visible. */
export const FailedTransactions: Story = {
  decorators: [
    withStoryProviders({
      query: txSeeds(
        mockTxHistory(3).map((tx) => ({ ...tx, status: "failed" as const })),
        STORY_ADDRESS,
      ),
    }),
  ],
};

/** Loading: the row skeletons are shown. */
export const Loading: Story = {
  decorators: [
    withStoryProviders({ pending: [["txHistory", STORY_ADDRESS, undefined]] }),
  ],
};

/** No matching transactions for this wallet. */
export const Empty: Story = {
  decorators: [
    withStoryProviders({ query: txSeeds([], STORY_ADDRESS) }),
  ],
};
