import type { Meta, StoryObj } from "@storybook/react";

import { INVOICE_STATUSES } from "../../.storybook/mockData";

import { InvoiceStatus } from "./InvoiceStatus";

/**
 * The lifecycle badge for an invoice. Every status the contract can report has
 * its own colour and icon; `Listed`, `Funded`, and `Active` additionally pulse
 * to signal "in flight".
 */
const meta = {
  title: "Invoice/InvoiceStatus",
  component: InvoiceStatus,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  argTypes: {
    status: { control: "select", options: INVOICE_STATUSES },
  },
  args: { status: "Created" },
} satisfies Meta<typeof InvoiceStatus>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Created: Story = { args: { status: "Created" } };
export const Listed: Story = { args: { status: "Listed" } };
export const Funded: Story = { args: { status: "Funded" } };
export const Active: Story = { args: { status: "Active" } };
export const Confirmed: Story = { args: { status: "Confirmed" } };
export const Repaid: Story = { args: { status: "Repaid" } };
export const Defaulted: Story = { args: { status: "Defaulted" } };

/** Every status at once, in contract order. */
export const AllStatuses: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      {INVOICE_STATUSES.map((status) => (
        <InvoiceStatus key={status} status={status} />
      ))}
    </div>
  ),
};
