import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import { AmountInput } from "./AmountInput";

/**
 * A labelled, asset-suffixed amount field used by the invoice form and the
 * calculators. Its suffix and preview text are derived from the selected
 * `asset`, so both assets are covered below.
 */
const meta = {
  title: "Shared/AmountInput",
  component: AmountInput,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  argTypes: {
    asset: { control: "inline-radio", options: ["USDC", "XLM"] },
  },
  args: {
    value: "",
    onChange: fn(),
    asset: "USDC",
  },
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AmountInput>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Empty, with the label derived from the asset. */
export const Empty: Story = {};

/** A filled value. */
export const Filled: Story = { args: { value: "50,000" } };

/** XLM is the native asset, so the suffix differs. */
export const XlmAsset: Story = { args: { value: "1,250", asset: "XLM" } };

/** A custom label, as the calculators use. */
export const CustomLabel: Story = {
  args: { label: "Deposit Amount (USDC)", placeholder: "10,000" },
};

/** A live preview line under the field. */
export const WithPreview: Story = {
  args: { value: "25000", showPreview: true, previewValue: 25000 },
};

/** Disabled while a submit is in flight. */
export const Disabled: Story = { args: { value: "1000", disabled: true } };

/** Marked required inside a validated form. */
export const Required: Story = { args: { required: true } };
