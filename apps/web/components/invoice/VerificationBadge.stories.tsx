import type { Meta, StoryObj } from "@storybook/react";

import { VerificationBadge } from "./VerificationBadge";
import type { VerificationState } from "./VerificationBadge";

/**
 * Shows the attestation state the indexer reports for an invoice. There are
 * exactly three states, plus an optional risk score that is only meaningful
 * once an invoice is `verified`.
 */
const meta = {
  title: "Invoice/VerificationBadge",
  component: VerificationBadge,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  argTypes: {
    state: {
      control: "inline-radio",
      options: ["unverified", "verified", "failed"] as VerificationState[],
    },
    riskScoreBps: { control: "number" },
  },
  args: {
    state: "unverified",
    riskScoreBps: null,
  },
} satisfies Meta<typeof VerificationBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No attestation yet — the default state for a freshly created invoice. */
export const Unverified: Story = { args: { state: "unverified" } };

/** Verified but without a published risk score. */
export const Verified: Story = { args: { state: "verified" } };

/** Verified with a risk score (basis points, rendered as a percentage). */
export const VerifiedWithRiskScore: Story = {
  args: { state: "verified", riskScoreBps: 275 },
};

/** The attestation ran and rejected the invoice. */
export const Failed: Story = { args: { state: "failed" } };

/** All states side by side for a visual diff. */
export const AllStates: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <VerificationBadge state="unverified" />
      <VerificationBadge state="verified" />
      <VerificationBadge state="verified" riskScoreBps={275} />
      <VerificationBadge state="failed" />
    </div>
  ),
};
