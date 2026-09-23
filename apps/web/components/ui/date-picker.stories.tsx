import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { expect, userEvent, within } from "@storybook/test";

import { DatePicker } from "./date-picker";

/**
 * The invoice form's due-date picker: a popover button that reveals a
 * `Calendar`. Stories cover the empty, filled, disabled, and (via a `play`
 * function) open-popover states.
 */
const meta = {
  title: "UI/DatePicker",
  component: DatePicker,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    onChange: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DatePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing selected — the placeholder state. */
export const Empty: Story = { args: { value: "" } };

/** A due date already chosen, rendered in the app's `PPP` format. */
export const Selected: Story = { args: { value: "2026-04-15" } };

/** Disabled while a submit is in flight. */
export const Disabled: Story = { args: { value: "", disabled: true } };

/** The calendar opened, as a user sees it mid-selection. */
export const OpenWithCalendar: Story = {
  args: { value: "" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button"));
    await expect(canvas.getByRole("button")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  },
};
