import type { Meta, StoryObj } from "@storybook/react";
import { expect, fireEvent, within } from "@storybook/test";

import { SmeCalculator } from "./SmeCalculator";

/**
 * The SME "with vs. without TrusTrove" comparison calculator. Its three inputs
 * are range/select controls, so the stories drive them with `fireEvent` to
 * capture the recalculated states.
 */
const meta = {
  title: "Shared/SmeCalculator",
  component: SmeCalculator,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="max-w-4xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SmeCalculator>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default terms: 50,000 USDC over 60 days at a 2% discount. */
export const Default: Story = {};

/** A larger invoice on 90-day terms. */
export const LargerInvoice: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    fireEvent.change(canvas.getByLabelText("Invoice Face Value"), {
      target: { value: "250000" },
    });
    fireEvent.change(canvas.getByRole("combobox"), {
      target: { value: "90" },
    });

    await expect(canvas.getByText("250,000 USDC")).toBeInTheDocument();
    await expect(canvas.getByText(/Net 90/)).toBeInTheDocument();
  },
};

/** A high discount rate, to show the maximum cost of financing. */
export const HighestDiscount: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    fireEvent.change(canvas.getByLabelText("Financing Discount Rate"), {
      target: { value: "5" },
    });

    await expect(canvas.getByText(/5\.0% \(500 bps\)/)).toBeInTheDocument();
  },
};
