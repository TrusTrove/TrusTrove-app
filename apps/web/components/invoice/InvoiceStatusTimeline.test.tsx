import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InvoiceStatusTimeline } from "./InvoiceStatusTimeline";
import type { Invoice } from "@/types";

const issuer = "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB";
const buyer = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

const makeInvoice = (overrides: Partial<Invoice> = {}): Invoice => ({
  id: "invoice-1",
  status: "Created",
  issuer,
  buyer,
  faceValue: 1_000_000_000n,
  asset: "USDC",
  discountBps: 500,
  fundedAmount: 0n,
  dueDate: 1_735_689_600,
  createdAt: 1_735_430_400,
  fundedAt: null,
  shippedAt: null,
  issuerConfirmed: false,
  buyerConfirmed: false,
  repaidAt: null,
  ...overrides,
});

describe("InvoiceStatusTimeline", () => {
  it("renders every timeline step and marks future steps as pending", () => {
    render(<InvoiceStatusTimeline invoice={makeInvoice()} />);

    expect(screen.getByText("Created")).toBeInTheDocument();
    expect(screen.getByText("Listed for Financing")).toBeInTheDocument();
    expect(screen.getByText("Funded by Pool")).toBeInTheDocument();
    expect(screen.getByText("Marked as Shipped")).toBeInTheDocument();
    expect(screen.getByText("Delivery Confirmed - Issuer")).toBeInTheDocument();
    expect(screen.getByText("Delivery Confirmed - Buyer")).toBeInTheDocument();
    expect(screen.getByText("Repaid / Defaulted")).toBeInTheDocument();
    expect(screen.getAllByText("Pending")).toHaveLength(6);
  });

  it("displays the Funded status branch correctly", () => {
    render(
      <InvoiceStatusTimeline
        invoice={makeInvoice({
          status: "Funded",
          fundedAt: 1_735_500_000,
        })}
      />,
    );

    expect(screen.getByText("Funded by Pool")).toBeInTheDocument();
    expect(screen.getByText("Repaid / Defaulted")).toBeInTheDocument();
    const pendingElements = screen.getAllByText("Pending");
    expect(pendingElements.length).toBeGreaterThan(0);
  });

  it("displays the Active status branch correctly with shipped state", () => {
    render(
      <InvoiceStatusTimeline
        invoice={makeInvoice({
          status: "Active",
          fundedAt: 1_735_500_000,
          shippedAt: 1_735_550_000,
        })}
      />,
    );

    expect(screen.getByText("Marked as Shipped")).toBeInTheDocument();
    expect(screen.getByText("Repaid / Defaulted")).toBeInTheDocument();
  });

  it("displays the Confirmed status branch correctly with issuer and buyer confirmation", () => {
    render(
      <InvoiceStatusTimeline
        invoice={makeInvoice({
          status: "Confirmed",
          fundedAt: 1_735_500_000,
          shippedAt: 1_735_550_000,
          issuerConfirmed: true,
          buyerConfirmed: true,
          buyerConfirmedAt: 1_735_600_000,
        })}
      />,
    );

    expect(screen.getByText("Delivery Confirmed - Buyer")).toBeInTheDocument();
    expect(screen.getByText("Repaid / Defaulted")).toBeInTheDocument();
  });

  it("advances the timeline and displays the repaid settlement state", () => {
    render(
      <InvoiceStatusTimeline
        invoice={makeInvoice({
          status: "Repaid",
          fundedAt: 1_735_500_000,
          shippedAt: 1_735_550_000,
          buyerConfirmed: true,
          buyerConfirmedAt: 1_735_600_000,
          repaidAt: 1_735_650_000,
        })}
      />,
    );

    expect(screen.getByText("Repaid")).toBeInTheDocument();
    expect(screen.queryByText("Repaid / Defaulted")).not.toBeInTheDocument();
    expect(screen.getAllByText(/Dec/).length).toBeGreaterThan(0);
  });

  it("displays the defaulted settlement state", () => {
    render(
      <InvoiceStatusTimeline
        invoice={makeInvoice({
          status: "Defaulted",
          fundedAt: 1_735_500_000,
          shippedAt: 1_735_550_000,
          buyerConfirmed: true,
          buyerConfirmedAt: 1_735_600_000,
          defaultedAt: 1_735_650_000,
        })}
      />,
    );

    expect(screen.getByText("Defaulted")).toBeInTheDocument();
    expect(screen.queryByText("Repaid / Defaulted")).not.toBeInTheDocument();
  });

  it("handles undefined/unknown status gracefully without throwing", () => {
    const invoiceWithUnknownStatus = makeInvoice({
      status: "UnknownStatus" as any,
    });

    expect(() => {
      render(<InvoiceStatusTimeline invoice={invoiceWithUnknownStatus} />);
    }).not.toThrow();

    expect(screen.getByText("Created")).toBeInTheDocument();
  });

  it("renders transaction hash links for mapped and legacy transaction fields", () => {
    render(
      <InvoiceStatusTimeline
        invoice={makeInvoice({
          status: "Active",
          ...({
            createdTxHash: "created-transaction-hash",
            transactionHashes: { shipped: "shipped-transaction-hash" },
          } as Partial<Invoice>),
        })}
      />,
    );

    expect(screen.getByRole("link", { name: /created-/i })).toHaveAttribute(
      "href",
      "https://stellar.expert/explorer/testnet/tx/created-transaction-hash",
    );
    expect(screen.getByRole("link", { name: /shipped-/i })).toHaveAttribute(
      "href",
      "https://stellar.expert/explorer/testnet/tx/shipped-transaction-hash",
    );
    expect(screen.getAllByText("No tx hash recorded")).toHaveLength(5);
  });
});
