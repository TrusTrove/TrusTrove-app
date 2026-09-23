import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";

import { DiscountCalculator } from "./DiscountCalculator";

/**
 * A tabbed wrapper around the two financing calculators. Both tabs are
 * self-contained (local state only), so the stories need no providers or
 * mocks — switching tabs is exercised with a `play` function.
 */
const meta = {
  title: "Shared/DiscountCalculator",
  component: DiscountCalculator,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="max-w-4xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DiscountCalculator>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Opens on the SME financing tab. */
export const SmeTab: Story = {};

/** Switch to the LP yield estimator tab. */
export const LpTab: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: /LP Yield Estimator/i }),
    );

    await expect(
      canvas.getByText(/LP Yield projection inputs/i),
    ).toBeInTheDocument();
  },
};
