import type { Meta, StoryObj } from "@storybook/react";

import type { Invoice } from "@/types";

import { mockInvoiceForStatus } from "../../.storybook/mockData";

import { InvoiceStatusTimeline } from "./InvoiceStatusTimeline";

/**
 * Renders the seven invoice lifecycle milestones and marks how far a given
 * invoice has progressed. The stories sweep every status the contract can
 * report, plus a fully-recorded invoice that links each step to its
 * transaction hash.
 */
const meta = {
  title: "Invoice/InvoiceStatusTimeline",
  component: InvoiceStatusTimeline,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: { invoice: mockInvoiceForStatus("Created") },
  decorators: [
    (Story) => (
      <div className="max-w-2xl rounded-lg border border-border bg-card p-5">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InvoiceStatusTimeline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Created: Story = {
  args: { invoice: mockInvoiceForStatus("Created") },
};

export const Listed: Story = {
  args: { invoice: mockInvoiceForStatus("Listed") },
};

export const Funded: Story = {
  args: { invoice: mockInvoiceForStatus("Funded") },
};

/** Shipped and confirmed by the issuer, awaiting the buyer. */
export const ActiveAwaitingBuyer: Story = {
  args: { invoice: mockInvoiceForStatus("Active") },
};

export const Confirmed: Story = {
  args: { invoice: mockInvoiceForStatus("Confirmed") },
};

export const Repaid: Story = {
  args: { invoice: mockInvoiceForStatus("Repaid") },
};

export const Defaulted: Story = {
  args: { invoice: mockInvoiceForStatus("Defaulted") },
};

const DAY_SECONDS = 24 * 60 * 60;
const hash = (seed: string) =>
  `${seed.repeat(64)}`.slice(0, 64);

type InvoiceWithTimeline = Invoice & {
  listedAt: number;
  transactionHashes: Partial<
    Record<
      | "created"
      | "listed"
      | "funded"
      | "shipped"
      | "issuerConfirmed"
      | "buyerConfirmed"
      | "settled",
      string
    >
  >;
};

const nowSeconds = Math.floor(Date.now() / 1000);

const fullyRecordedInvoice: InvoiceWithTimeline = {
  ...mockInvoiceForStatus("Active"),
  listedAt: nowSeconds - 9 * DAY_SECONDS,
  transactionHashes: {
    created: hash("a1"),
    listed: hash("b2"),
    funded: hash("c3"),
    shipped: hash("d4"),
    issuerConfirmed: hash("e5"),
  },
};

/** Every completed step links out to its recorded transaction. */
export const WithTransactionHashes: Story = {
  args: { invoice: fullyRecordedInvoice },
};
