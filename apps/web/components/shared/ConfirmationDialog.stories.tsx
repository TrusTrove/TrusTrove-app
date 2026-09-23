import type { Meta, StoryObj } from "@storybook/react";

import { withStoryProviders } from "../../.storybook/decorators";

import { ConfirmationDialog } from "./ConfirmationDialog";

/**
 * A modal guard for irreversible on-chain actions. It is driven entirely by the
 * `confirmDialog` Zustand store, so the stories seed that store instead of
 * passing props: one story per pending action, plus the closed state.
 */
const meta = {
  title: "Shared/ConfirmationDialog",
  component: ConfirmationDialog,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [withStoryProviders({ pendingAction: null })],
} satisfies Meta<typeof ConfirmationDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No pending action: the dialog renders nothing. */
export const Closed: Story = {};

/** Confirming delivery, from the buyer's invoice card. */
export const ConfirmDelivery: Story = {
  decorators: [
    withStoryProviders({
      pendingAction: {
        label: "Confirm Delivery",
        invoiceId:
          "9f2c1a4b7e8d3f6051a2b3c4d5e6f70819a2b3c4d5e6f70819a2b3c4d5e6f708",
        fn: async () => undefined,
      },
    }),
  ],
};

/** Repaying an invoice. */
export const RepayInvoice: Story = {
  decorators: [
    withStoryProviders({
      pendingAction: {
        label: "Repay Invoice",
        invoiceId:
          "1a2b3c4d5e6f70819a2b3c4d5e6f70819a2b3c4d5e6f70819a2b3c4d5e6f70819a",
        fn: async () => undefined,
      },
    }),
  ],
};

/** Triggering default on an overdue invoice. */
export const TriggerDefault: Story = {
  decorators: [
    withStoryProviders({
      pendingAction: {
        label: "Trigger Default",
        invoiceId:
          "d3adb33f0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4",
        fn: async () => undefined,
      },
    }),
  ],
};
