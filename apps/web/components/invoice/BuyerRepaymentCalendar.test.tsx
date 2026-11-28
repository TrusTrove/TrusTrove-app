import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { BuyerRepaymentCalendar } from "./BuyerRepaymentCalendar";
import type { Invoice } from "@/types";

const DAY = 86_400;
const NOW = 1_700_000_000;

function makeInvoice(overrides: Partial<Invoice>): Invoice {
  return {
    id: "a".repeat(64),
    issuer: "GISSUER",
    buyer: "GBUYER",
    faceValue: 10_000_000n,
    asset: "USDC",
    discountBps: 0,
    fundedAmount: 0n,
    dueDate: NOW + DAY,
    status: "Funded",
    createdAt: NOW - DAY,
    fundedAt: NOW - DAY,
    shippedAt: null,
    issuerConfirmed: false,
    buyerConfirmed: false,
    repaidAt: null,
    ...overrides,
  };
}

describe("BuyerRepaymentCalendar", () => {
  it("renders an empty state when there is nothing to repay", () => {
    render(<BuyerRepaymentCalendar invoices={[]} now={NOW} />);

    expect(
      screen.getByRole("region", { name: /Buyer Repayment Calendar/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("No upcoming repayments.")).toBeInTheDocument();
  });

  it("groups invoices by due date and links each one to its invoice", () => {
    const first = makeInvoice({
      id: "1".repeat(64),
      dueDate: NOW + 2 * DAY,
      faceValue: 10_000_000n,
    });
    const second = makeInvoice({
      id: "2".repeat(64),
      dueDate: NOW + 2 * DAY,
      faceValue: 25_000_000n,
    });
    const third = makeInvoice({
      id: "3".repeat(64),
      dueDate: NOW + 5 * DAY,
      faceValue: 5_000_000n,
    });

    render(
      <BuyerRepaymentCalendar invoices={[first, second, third]} now={NOW} />,
    );

    // Two due dates -> two groups, one of which holds both invoices.
    const groups = screen.getAllByRole("heading", { level: 3 });
    expect(groups).toHaveLength(2);

    const firstGroup = groups[0].closest("div.rounded-md") as HTMLElement;
    expect(within(firstGroup).getAllByRole("listitem")).toHaveLength(2);
    expect(within(firstGroup).getByText("1.00 USDC")).toBeInTheDocument();
    expect(within(firstGroup).getByText("2.50 USDC")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /^11111111…$/ })).toHaveAttribute(
      "href",
      `/invoice/${first.id}`,
    );
    expect(screen.getByRole("link", { name: /^33333333…$/ })).toHaveAttribute(
      "href",
      `/invoice/${third.id}`,
    );
  });

  it("marks groups and invoices past their due date as overdue", () => {
    const overdue = makeInvoice({ id: "4".repeat(64), dueDate: NOW - DAY });
    const upcoming = makeInvoice({ id: "5".repeat(64), dueDate: NOW + DAY });

    render(<BuyerRepaymentCalendar invoices={[overdue, upcoming]} now={NOW} />);

    // One "Overdue" badge for the group plus one per overdue invoice.
    expect(screen.getAllByText("Overdue")).toHaveLength(2);
    expect(screen.getByText("Due")).toBeInTheDocument();
  });

  it("shows the timezone in use", () => {
    render(
      <BuyerRepaymentCalendar
        invoices={[makeInvoice({})]}
        now={NOW}
        timezone="America/New_York"
      />,
    );

    expect(screen.getByText("Timezone: America/New_York")).toBeInTheDocument();
  });

  it("groups by the calendar day of the requested timezone", () => {
    // 2023-11-15T00:30Z is still 2023-11-14 in New York (UTC-5) but the
    // following day in UTC, so a single due date must split across two groups.
    const instant = Date.UTC(2023, 10, 15, 0, 30) / 1000;

    const { unmount } = render(
      <BuyerRepaymentCalendar
        invoices={[
          makeInvoice({ dueDate: instant }),
          makeInvoice({ id: "6".repeat(64), dueDate: instant + DAY }),
        ]}
        now={NOW}
        timezone="UTC"
      />,
    );
    // UTC: the two invoices fall on consecutive days.
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(2);
    unmount();

    render(
      <BuyerRepaymentCalendar
        invoices={[makeInvoice({ dueDate: instant })]}
        now={NOW}
        timezone="America/New_York"
      />,
    );
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(
      /November 14, 2023/,
    );
  });
});
