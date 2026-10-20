import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { InvoiceCard } from "@/components/invoice/InvoiceCard";
import type { Invoice } from "@/types";

const ISSUER = "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB";
const BUYER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

/** A full registry-shaped invoice, varied per story through `overrides`. */
const makeInvoice = (overrides: Partial<Invoice> = {}): Invoice => ({
  id: "0f3c9a1e6b8d47f2015c8e9a3b7d46f1c02e5a8b9d3f6c1a4e7b0d2f58c16a93",
  issuer: ISSUER,
  buyer: BUYER,
  faceValue: 100_000_000_000n, // 10,000.00 USDC
  asset: "USDC",
  discountBps: 200,
  fundedAmount: 0n,
  dueDate: 1_735_689_600,
  status: "Created",
  createdAt: 1_730_300_000,
  fundedAt: null,
  shippedAt: null,
  issuerConfirmed: false,
  buyerConfirmed: false,
  repaidAt: null,
  ...overrides,
});

// The card reads through react-query hooks, so it needs a client in scope.
const queryClient = new QueryClient();

/**
 * Storybook is not part of the workspace install, so these stories stay in
 * dependency-free CSF3 (see `Button.stories.tsx`);
 * `src/components/stories.test.tsx` renders them with their decorators.
 */
const meta = {
  title: "Invoice/InvoiceCard",
  component: InvoiceCard,
  decorators: [
    (Story: () => React.ReactElement) => (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
};

export default meta;

type Story = {
  render: (
    args: React.ComponentProps<typeof InvoiceCard>,
  ) => React.ReactElement;
  args: React.ComponentProps<typeof InvoiceCard>;
};

export const IssuerCreated: Story = {
  render: (args) => <InvoiceCard {...args} />,
  args: { invoice: makeInvoice(), role: "issuer" },
};

export const IssuerFunded: Story = {
  render: (args) => <InvoiceCard {...args} />,
  args: {
    invoice: makeInvoice({
      status: "Funded",
      fundedAmount: 98_000_000_000n,
      fundedAt: 1_730_400_000,
    }),
    role: "issuer",
  },
};

export const BuyerActive: Story = {
  render: (args) => <InvoiceCard {...args} />,
  args: {
    invoice: makeInvoice({
      id: "7b21d4e8f0a3569c12de4b7a80f3c15e9d2a6b40c8f137ade5b9024c6f18d3a7",
      status: "Active",
      discountBps: 450,
      fundedAmount: 98_000_000_000n,
      fundedAt: 1_730_400_000,
      shippedAt: 1_731_000_000,
      issuerConfirmed: true,
    }),
    role: "buyer",
  },
};

export const LPListed: Story = {
  render: (args) => <InvoiceCard {...args} />,
  args: {
    invoice: makeInvoice({
      id: "c4a17f0d9b2e83615fc0a4d7b1e9360a2d5c8f14b70e3a96d1c5f80b24e7a3d9",
      status: "Listed",
    }),
    role: "lp",
  },
};

export const Defaulted: Story = {
  render: (args) => <InvoiceCard {...args} />,
  args: {
    invoice: makeInvoice({
      id: "1d8c3f7a0b25e964c1f08d7b3a5e02c9f146a8d0b5c3e7f1a90d24c8b6e5a370",
      status: "Defaulted",
      fundedAmount: 98_000_000_000n,
      fundedAt: 1_730_400_000,
      defaultedAt: 1_736_000_000,
    }),
    role: "issuer",
  },
};

export const SelectedForComparison: Story = {
  render: (args) => <InvoiceCard {...args} />,
  args: {
    invoice: makeInvoice(),
    role: "issuer",
    isSelected: true,
    onSelect: () => {},
  },
};
