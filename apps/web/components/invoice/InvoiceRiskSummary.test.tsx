import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { InvoiceRiskSummary } from "./InvoiceRiskSummary";
import { Invoice } from "@/types";

const mockInvoice: Invoice = {
  id: "inv_test_123",
  issuer: "GCV5ODH3SMUDETURTOQPQ7TD2YI4YS6DZMMXDFLSWLGBFZTCHYL6LDNW",
  buyer: "GDSCOJVNZ4JUVWZ5O6VBTUGOH4ZE22QJ6WMOYWHB3FEDQ2APJ2RQEIHY",
  faceValue: 1000000000n,
  asset: "USDC",
  discountBps: 250,
  fundedAmount: 0n,
  dueDate: Math.floor(Date.now() / 1000) + 86400 * 30,
  status: "Listed",
  createdAt: Math.floor(Date.now() / 1000),
  riskScoreBps: 1500,
  fundedAt: null,
  shippedAt: null,
  issuerConfirmed: false,
  buyerConfirmed: false,
  repaidAt: null,
};

describe("InvoiceRiskSummary", () => {
  it("renders buyer verification, maturity, discount, pool capacity, and funding amount", () => {
    render(
      <InvoiceRiskSummary
        invoice={mockInvoice}
        poolCapacity={5000000000n}
        fundingAmount={1000000000n}
      />,
    );

    expect(screen.getByRole("region", { name: /Pre-signing Risk Summary/i })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      /Verified · risk score 15.0%/i,
    );
    expect(screen.getByText(/2.50%/i)).toBeInTheDocument();
    expect(screen.getByText(/500.00 USDC/i)).toBeInTheDocument();
    expect(screen.getByText(/100.00 USDC/i)).toBeInTheDocument();
  });

  it("shows warning boundary when funding amount exceeds pool capacity", () => {
    render(
      <InvoiceRiskSummary
        invoice={mockInvoice}
        poolCapacity={500000500n}
        fundingAmount={1000000000n}
      />,
    );

    expect(
      screen.getByText(/Funding amount exceeds available pool capacity/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("handles unverified buyer state correctly", () => {
    const unverifiedInvoice = { ...mockInvoice, riskScoreBps: null };
    render(
      <InvoiceRiskSummary
        invoice={unverifiedInvoice}
        poolCapacity={5000000000n}
        fundingAmount={1000000000n}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(/Unverified/i);
  });
});
