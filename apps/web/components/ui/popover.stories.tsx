import type { Meta, StoryObj } from "@storybook/react";
import { userEvent, within } from "@storybook/test";

import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

/**
 * `Popover` is the unopinionated Radix primitive re-exported by shadcn/ui. It
 * only renders DOM through `PopoverContent`, so the stories below compose the
 * three parts the way the app does (most notably inside `DatePicker`).
 */
const meta = {
  title: "UI/Popover",
  component: Popover,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

function PopoverExample() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Open popover</Button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-white">Invoice terms</p>
          <p className="text-xs text-slate-400">
            Discount is agreed between the SME and the protocol before listing.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Closed by default — only the trigger is in the tree. */
export const Closed: Story = {
  render: () => <PopoverExample />,
};

/** Opened via the trigger, so the content portal is rendered too. */
export const Open: Story = {
  render: () => <PopoverExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /open popover/i }));
  },
};

/** Aligned to the start edge, as `DatePicker` uses it. */
export const AlignedStart: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Aligned start</Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-3">
        <p className="text-xs text-slate-300">Content aligned to start.</p>
      </PopoverContent>
    </Popover>
  ),
};
