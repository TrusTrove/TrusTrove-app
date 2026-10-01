import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterAll, describe, expect, it, vi } from "vitest";
import { DatePicker } from "@/components/ui/date-picker";

const calendarState = vi.hoisted(() => ({
  selectedDate: new Date(2026, 0, 1),
}));

vi.mock("@/components/ui/calendar", () => ({
  Calendar: ({ onSelect }: { onSelect: (date: Date) => void }) => (
    <button onClick={() => onSelect(calendarState.selectedDate)}>
      Choose date
    </button>
  ),
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  PopoverContent: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

const originalTimezone = process.env.TZ;

afterAll(() => {
  if (originalTimezone === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = originalTimezone;
  }
});

describe("DatePicker", () => {
  it.each([
    ["America/Los_Angeles", "2026-08-30T00:30:00-07:00"],
    ["Pacific/Auckland", "2026-08-30T00:30:00+12:00"],
  ])("preserves the selected calendar day in %s", (timezone, timestamp) => {
    process.env.TZ = timezone;
    calendarState.selectedDate = new Date(timestamp);
    const onChange = vi.fn();

    render(<DatePicker onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose date" }));

    expect(onChange).toHaveBeenCalledWith("2026-08-30");
  });

  it("parses a stored date as a local calendar date", () => {
    process.env.TZ = "America/Los_Angeles";

    render(<DatePicker value="2026-08-30" onChange={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: /August 30th, 2026/i }),
    ).toBeInTheDocument();
  });
});
