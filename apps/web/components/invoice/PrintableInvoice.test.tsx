import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { PrintableInvoice } from "./PrintableInvoice";
import type { Invoice } from "@/types";

const sampleInvoice: Invoice = {
  id: "inv-print-001",
  status: "Funded",
  issuer: "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
  buyer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  faceValue: 1000000000n,
  asset: "USDC",
  discountBps: 250,
  fundedAmount: 1000000000n,
  dueDate: 1_735_689_600,
  createdAt: 1_735_430_400,
  fundedAt: 1_735_431_400,
  shippedAt: null,
  issuerConfirmed: false,
  buyerConfirmed: false,
  repaidAt: null,
  createdTxHash: "0xabc123created",
  fundedTxHash: "0xdef456funded",
} as any;

describe("PrintableInvoice", () => {
  it("renders parties, amounts, due date, lifecycle status, contract ID, and transaction references", () => {
    render(
      <PrintableInvoice invoice={sampleInvoice} contractId="C_TEST_CONTRACT" />,
    );

    expect(screen.getByText("INVOICE REVIEW ARTIFACT")).toBeInTheDocument();
    expect(screen.getByText(sampleInvoice.issuer)).toBeInTheDocument();
    expect(screen.getByText(sampleInvoice.buyer)).toBeInTheDocument();
    expect(screen.getAllByText(/100\.00 USDC/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Funded/i)).toBeInTheDocument();
    expect(screen.getByText(/C_TEST_CONTRACT/i)).toBeInTheDocument();
    expect(screen.getByText("0xabc123created")).toBeInTheDocument();
    expect(screen.getByText("0xdef456funded")).toBeInTheDocument();
  });

  it("handles permission boundary and empty/missing transaction references gracefully", () => {
    const emptyInvoice: Invoice = {
      ...sampleInvoice,
      id: "inv-empty-002",
      fundedAmount: 0n,
      createdTxHash: undefined,
      fundedTxHash: undefined,
    } as any;

    render(<PrintableInvoice invoice={emptyInvoice} contractId="" />);

    expect(screen.getByText((content, node) => node?.textContent === "Invoice ID: inv-empty-002")).toBeInTheDocument();
    expect(
      screen.queryByText("Transaction References"),
    ).not.toBeInTheDocument();
  });
});
