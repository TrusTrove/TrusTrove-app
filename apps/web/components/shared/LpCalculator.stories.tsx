import type { Meta, StoryObj } from "@storybook/react";
import { expect, fireEvent, within } from "@storybook/test";

import { LpCalculator } from "./LpCalculator";

/**
 * The LP yield projector behind the calculator's second tab. Its inputs are
 * range sliders and the outputs are derived on every render, so `play`
 * functions set the sliders and assert the recomputed figures.
 */
const meta = {
  title: "Shared/LpCalculator",
  component: LpCalculator,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="max-w-4xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LpCalculator>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Defaults: 10,000 USDC deposit, 80% utilization, 2% discount, 60 days. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("10,000 USDC")).toBeInTheDocument();
  },
};

/** A larger deposit with lower utilization. */
export const LargeDepositLowerUtilization: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    fireEvent.change(canvas.getByLabelText("Total USDC Deposit"), {
      target: { value: "100000" },
    });
    fireEvent.change(canvas.getByLabelText("Target Pool Utilization"), {
      target: { value: "40" },
    });

    await expect(canvas.getByText("100,000 USDC")).toBeInTheDocument();
    await expect(canvas.getByText("40%")).toBeInTheDocument();
  },
};

/** A short maturity, which raises the projected APR. */
export const ShortMaturity: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    fireEvent.change(canvas.getByLabelText("Avg Days to Maturity"), {
      target: { value: "15" },
    });

    await expect(canvas.getByText("15 Days")).toBeInTheDocument();
  },
};
