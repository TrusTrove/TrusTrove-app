import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import { mockInvoices } from "../../.storybook/mockData";

import { InvoiceTable } from "./InvoiceTable";

/**
 * The virtualized invoice ledger. Stories cover the populated table (including
 * a long list that exercises the row virtualizer), the empty state, a custom
 * empty-state action, selection highlighting, and the pagination footer.
 */
const meta = {
  title: "Invoice/InvoiceTable",
  component: InvoiceTable,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: {
    invoices: mockInvoices(6),
    onSelectInvoice: fn(),
    activeId: null,
  },
  decorators: [
    (Story) => (
      <div className="p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InvoiceTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A handful of invoices across different lifecycle statuses. */
export const WithInvoices: Story = {};

/** A long list, so the virtualizer only mounts the visible rows. */
export const ManyRows: Story = {
  args: { invoices: mockInvoices(120) },
};

/** One row is currently selected. */
export const ActiveRowSelected: Story = {
  args: {
    invoices: mockInvoices(6),
    activeId: mockInvoices(1)[0].id,
  },
};

/** The empty ledger with the default call to action. */
export const Empty: Story = {
  args: { invoices: [] },
};

/** The empty ledger with a caller-supplied action. */
export const EmptyWithCustomAction: Story = {
  args: {
    invoices: [],
    emptyStateTitle: "No open invoices",
    emptyStateDescription:
      "Nothing matches the current filters. Clear them to see every invoice.",
    emptyStateAction: { label: "Clear filters", onClick: fn() },
  },
};

/** Pagination footer with more than one page of results. */
export const WithPagination: Story = {
  args: {
    invoices: mockInvoices(10),
    pagination: {
      page: 1,
      limit: 10,
      total: 42,
      totalPages: 5,
      onPageChange: fn(),
      onLimitChange: fn(),
    },
  },
};
