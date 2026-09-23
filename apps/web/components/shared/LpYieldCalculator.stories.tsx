import type { Meta, StoryObj } from "@storybook/react";
import { expect, fireEvent, userEvent, within } from "@storybook/test";

import { LpYieldCalculator } from "./LpYieldCalculator";

/**
 * The standalone LP yield card, which pairs a free-text deposit field with a
 * utilization slider and compares the result against savings and T-bills.
 */
const meta = {
  title: "Shared/LpYieldCalculator",
  component: LpYieldCalculator,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div className="w-[420px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LpYieldCalculator>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Defaults: a 10,000 USDC deposit at 75% utilization. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByDisplayValue("10000")).toBeInTheDocument();
  },
};

/** A larger deposit, which scales the monthly earnings. */
export const LargerDeposit: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByDisplayValue("10000");

    await userEvent.clear(input);
    await userEvent.type(input, "50000");

    await expect(canvas.getByDisplayValue("50000")).toBeInTheDocument();
  },
};

/** Maximum utilization, the best-case yield scenario. */
export const FullUtilization: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    fireEvent.change(canvas.getByLabelText("Pool Utilization"), {
      target: { value: "100" },
    });

    await expect(canvas.getByText("100%")).toBeInTheDocument();
  },
};

/** An empty deposit field, which should not throw. */
export const EmptyDeposit: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByDisplayValue("10000");

    await userEvent.clear(input);

    await expect(canvas.getByText(/Estimated Annual Yield/i)).toBeInTheDocument();
  },
};
