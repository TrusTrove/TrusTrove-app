import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { InvoiceTable } from "./InvoiceTable";

const mockInvoices = [
  {
    id: "1",
    status: "created",
    issuer: "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
    buyer: "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
    faceValue: 10000000000n, // 1000.00 USDC
    dueDate: 1234567890,
  },
  {
    id: "2",
    status: "Funded",
    issuer: "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
    buyer: "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
    faceValue: 20000000000n, // 2000.00 USDC
    dueDate: 1234567891,
  },
];

describe("InvoiceTable", () => {
  it("renders a list of invoices", () => {
    render(<InvoiceTable invoices={mockInvoices as any} />);
    expect(screen.getByText(/1,000.00 USDC/)).toBeInTheDocument();
    expect(screen.getByText(/2,000.00 USDC/)).toBeInTheDocument();
  });

  it("renders empty state when no invoices", () => {
    render(<InvoiceTable invoices={[]} />);
    expect(screen.getByText(/No invoices found/i)).toBeInTheDocument();
  });
});
