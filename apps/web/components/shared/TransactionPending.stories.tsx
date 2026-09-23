import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import { TransactionPending } from "./TransactionPending";

/**
 * The modal shown while a transaction is being signed and submitted. Its props
 * drive every state: waiting (no hash yet, not dismissable), completed (hash
 * present, dismissable), and closed (renders nothing).
 */
const meta = {
  title: "Shared/TransactionPending",
  component: TransactionPending,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: {
    isOpen: true,
    txHash: null,
    onClose: fn(),
  },
} satisfies Meta<typeof TransactionPending>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Waiting for confirmation: no transaction hash yet. */
export const WaitingForConfirmation: Story = {};

/** Custom status copy supplied by the caller. */
export const CustomStatusText: Story = {
  args: { statusText: "Submitting repayment to the pool…" },
};

/** Confirmed: the hash is shown and can be opened in Stellar Expert. */
export const Completed: Story = {
  args: {
    txHash:
      "d3adb33f0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4",
  },
};

/** Closed: the dialog renders nothing. */
export const Closed: Story = {
  args: { isOpen: false },
};

/** Open without a close handler — dismissal stays disabled until it completes. */
export const NoCloseHandler: Story = {
  args: { onClose: undefined },
};
