import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import { mockInvoice, mockInvoiceForStatus } from "../../.storybook/mockData";
import { profileSeeds, withStoryProviders } from "../../.storybook/decorators";

import { InvoiceCard } from "./InvoiceCard";

/**
 * The core invoice tile. Which action button appears is a function of the
 * invoice's lifecycle status, the viewer's `role`, and whether the invoice is
 * overdue — so the stories below cover each status/role combination. All data
 * is seeded into the react-query cache and the wallet store, so no Soroban RPC
 * or Freighter extension is required.
 *
 * Note `showActions` requires a connected wallet: the `wallet` decorator option
 * supplies one, and a dedicated `DisconnectedWallet` story covers the other
 * branch.
 */
const meta = {
  title: "Invoice/InvoiceCard",
  component: InvoiceCard,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    invoice: mockInvoice({ status: "Created" }),
    role: "issuer",
    onSelect: fn(),
    isSelected: false,
  },
  decorators: [
    (Story) => (
      <div className="w-[420px]">
        <Story />
      </div>
    ),
    withStoryProviders({
      wallet: { role: "issuer" },
      query: profileSeeds(),
    }),
  ],
} satisfies Meta<typeof InvoiceCard>;

export default meta;
type Story = StoryObj<typeof meta>;

// ── Lifecycle states ───────────────────────────────────────────────────

/** Created: the issuer can configure financing terms. */
export const CreatedIssuer: Story = {
  args: { invoice: mockInvoiceForStatus("Created"), role: "issuer" },
};

/** Listed: an LP can fund the invoice. */
export const ListedLp: Story = {
  args: { invoice: mockInvoiceForStatus("Listed"), role: "lp" },
};

/** Funded: the issuer marks the goods as shipped. */
export const FundedIssuer: Story = {
  args: { invoice: mockInvoiceForStatus("Funded"), role: "issuer" },
};

/** Shipped/active: the buyer confirms delivery. */
export const ActiveBuyer: Story = {
  args: { invoice: mockInvoiceForStatus("Active"), role: "buyer" },
};

/** Confirmed: the buyer repays the invoice. */
export const ConfirmedBuyer: Story = {
  args: { invoice: mockInvoiceForStatus("Confirmed"), role: "buyer" },
};

/** Repaid: a terminal state with no further actions. */
export const Repaid: Story = {
  args: {
    invoice: mockInvoiceForStatus("Repaid"),
    role: "issuer",
  },
};

/** Defaulted: a terminal state, shown with the overdue urgency signal. */
export const Defaulted: Story = {
  args: {
    invoice: mockInvoiceForStatus("Defaulted"),
    role: "buyer",
  },
};

/** Overdue and still active, which surfaces the "trigger default" action. */
export const OverdueActiveBuyer: Story = {
  args: {
    invoice: mockInvoice({
      status: "Active",
      shippedAt: Math.floor(Date.now() / 1000) - 10 * 24 * 3600,
      dueDate: Math.floor(Date.now() / 1000) - 2 * 24 * 3600,
    }),
    role: "buyer",
  },
};

// ── Verification and selection states ──────────────────────────────────

/** Verified with a risk score — the badge shows the attestation result. */
export const VerifiedWithRiskScore: Story = {
  args: {
    invoice: mockInvoice({ status: "Listed", riskScoreBps: 250 }),
    role: "lp",
  },
  decorators: [
    withStoryProviders({
      wallet: { role: "lp" },
      query: profileSeeds(),
    }),
  ],
};

/**
 * An unverified wallet: actions are rendered but disabled, with an inline
 * warning. The `profileSeeds(false)` arg overrides the default verified seed.
 */
export const UnverifiedWallet: Story = {
  args: { invoice: mockInvoiceForStatus("Listed"), role: "lp" },
  decorators: [
    withStoryProviders({
      wallet: { role: "lp" },
      query: profileSeeds(undefined, false),
    }),
  ],
};

/** No wallet connected: the action area is omitted entirely. */
export const DisconnectedWallet: Story = {
  args: { invoice: mockInvoiceForStatus("Created"), role: "issuer" },
  decorators: [
    withStoryProviders({
      wallet: null,
      query: profileSeeds(undefined, false),
    }),
  ],
};

/** Selected in a list: highlighted border and glow. */
export const Selected: Story = {
  args: {
    invoice: mockInvoiceForStatus("Listed"),
    role: "lp",
    isSelected: true,
  },
};
