import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ReceivablesAging } from "./ReceivablesAging";
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
    fundedAmount: 10_000_000n,
    dueDate: NOW,
    status: "Funded",
    createdAt: NOW - 30 * DAY,
    fundedAt: NOW - 30 * DAY,
    shippedAt: null,
    issuerConfirmed: false,
    buyerConfirmed: false,
    repaidAt: null,
    ...overrides,
  };
}

describe("ReceivablesAging", () => {
  it("always renders every bucket, even when empty", () => {
    render(<ReceivablesAging invoices={[]} now={NOW} />);

    expect(
      screen.getByRole("region", { name: "Receivables Aging" }),
    ).toBeInTheDocument();
    ["Current", "1-30 days", "31-60 days", "61-90 days", "90+ days"].forEach(
      (label) => {
        expect(screen.getByText(label)).toBeInTheDocument();
      },
    );
    expect(screen.getAllByText("0 invoices")).toHaveLength(5);
    expect(screen.getByText("Total: 0.00 USDC")).toBeInTheDocument();
  });

  it("aggregates counts and face values into non-overlapping buckets", () => {
    const invoices = [
      makeInvoice({ id: "1", dueDate: NOW + DAY, faceValue: 10_000_000n }),
      makeInvoice({ id: "2", dueDate: NOW - 10 * DAY, faceValue: 20_000_000n }),
      makeInvoice({ id: "3", dueDate: NOW - 30 * DAY, faceValue: 30_000_000n }),
      makeInvoice({ id: "4", dueDate: NOW - 45 * DAY, faceValue: 40_000_000n }),
      makeInvoice({ id: "5", dueDate: NOW - 90 * DAY, faceValue: 50_000_000n }),
      makeInvoice({
        id: "6",
        dueDate: NOW - 200 * DAY,
        faceValue: 60_000_000n,
      }),
    ];

    render(<ReceivablesAging invoices={invoices} now={NOW} />);

    const rowFor = (label: string) =>
      screen.getByText(label).closest("div.rounded-md") as HTMLElement;

    // Not yet due (due date in the future) counts as Current.
    expect(rowFor("Current")).toHaveTextContent("1 invoice");
    expect(rowFor("Current")).toHaveTextContent("1.00 USDC");

    expect(rowFor("1-30 days")).toHaveTextContent("2 invoices");
    expect(rowFor("1-30 days")).toHaveTextContent("5.00 USDC");

    expect(rowFor("31-60 days")).toHaveTextContent("1 invoice");
    expect(rowFor("31-60 days")).toHaveTextContent("4.00 USDC");

    expect(rowFor("61-90 days")).toHaveTextContent("1 invoice");
    expect(rowFor("61-90 days")).toHaveTextContent("5.00 USDC");

    expect(rowFor("90+ days")).toHaveTextContent("1 invoice");
    expect(rowFor("90+ days")).toHaveTextContent("6.00 USDC");
  });

  it("totals the face value across all buckets", () => {
    render(
      <ReceivablesAging
        invoices={[
          makeInvoice({ id: "1", dueDate: NOW - 5 * DAY }),
          makeInvoice({ id: "2", dueDate: NOW - 120 * DAY }),
        ]}
        now={NOW}
      />,
    );

    expect(screen.getByText("Total: 2.00 USDC")).toBeInTheDocument();
  });

  it("respects custom bucket boundaries", () => {
    render(
      <ReceivablesAging
        invoices={[makeInvoice({ dueDate: NOW - 5 * DAY })]}
        now={NOW}
        buckets={[
          { label: "Fresh", minDays: 0, maxDays: 7 },
          { label: "Stale", minDays: 8, maxDays: null },
        ]}
      />,
    );

    expect(screen.getByText("1 invoice")).toBeInTheDocument();
    expect(screen.getByText("Stale")).toBeInTheDocument();
  });
});
