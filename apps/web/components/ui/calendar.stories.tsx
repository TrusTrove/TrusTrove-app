import React from "react";
import type { Meta, StoryObj } from "@storybook/react";

import { Calendar } from "./calendar";

/**
 * `Calendar` is a thin, themed wrapper around `react-day-picker`'s `DayPicker`.
 * The stories below cover the two states the app actually renders: a selected
 * single date (the date picker's resting state) and an interactive one users
 * can click through.
 */
const meta = {
  title: "UI/Calendar",
  component: Calendar,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    // react-day-picker is client-only; the Next.js addon still renders it in
    // the browser iframe, so no backend is required.
  },
  args: {
    mode: "single",
    defaultMonth: new Date(2026, 2, 1),
  },
} satisfies Meta<typeof Calendar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No date chosen yet — the state the invoice form opens with. */
export const NoSelection: Story = {
  args: { selected: undefined, onSelect: () => undefined },
};

/** A single date selected. */
export const Selected: Story = {
  args: { selected: new Date(2026, 2, 15), onSelect: () => undefined },
};

/** Dates in the past are disabled, as the invoice due-date picker does. */
export const WithDisabledDays: Story = {
  args: {
    selected: new Date(2026, 2, 20),
    onSelect: () => undefined,
    disabled: { before: new Date(2026, 2, 10) },
  },
};

function InteractiveCalendar() {
  const [selected, setSelected] = React.useState<Date | undefined>(
    new Date(2026, 2, 15),
  );

  return (
    <Calendar
      mode="single"
      selected={selected}
      onSelect={(date) => setSelected(date ?? undefined)}
      defaultMonth={new Date(2026, 2, 1)}
    />
  );
}

/** Click a day to move the selection. */
export const Interactive: Story = {
  render: () => <InteractiveCalendar />,
};
