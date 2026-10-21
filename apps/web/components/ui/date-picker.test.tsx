import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterAll, describe, expect, it, vi } from "vitest";
import { DatePicker } from "@/components/ui/date-picker";

const calendarState = vi.hoisted(() => ({
  selectedDate: new Date(2026, 0, 1),
}));

// Fixed dates the mock calendar renders so consumers can assert disabled state.
const MOCK_DATES = [
  new Date(2026, 0, 5),
  new Date(2026, 0, 10),
  new Date(2026, 0, 15),
];

vi.mock("@/components/ui/calendar", () => ({
  Calendar: ({
    onSelect,
    disabled,
  }: {
    onSelect: (date: Date) => void;
    disabled?: (date: Date) => boolean;
  }) => (
    <div>
      <button onClick={() => onSelect(calendarState.selectedDate)}>
        Choose date
      </button>
      {MOCK_DATES.map((date) => {
        const isDisabled = disabled?.(date);
        return (
          <button
            key={date.toISOString()}
            data-date={date.toISOString()}
            aria-label={date.toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
            })}
            {...(isDisabled ? { disabled: true } : {})}
            onClick={() => onSelect(date)}
          >
            {date.getDate()}
          </button>
        );
      })}
    </div>
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

  it("disables dates before minDate and enables minDate itself (#1100)", () => {
    // Pin the timezone so the fixed mock dates render deterministically.
    process.env.TZ = "UTC";
    const minDate = new Date(2026, 0, 10);
    const onChange = vi.fn();

    render(<DatePicker minDate={minDate} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /Select due date/ }));

    const beforeMin = screen.getByText("5");
    const atMin = screen.getByText("10");
    const afterMin = screen.getByText("15");

    expect(beforeMin).toBeDisabled();
    expect(atMin).not.toBeDisabled();
    expect(afterMin).not.toBeDisabled();
  });
});
