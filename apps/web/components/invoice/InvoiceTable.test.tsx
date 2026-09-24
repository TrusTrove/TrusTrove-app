import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
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

  it("renders a helpful empty state when no invoices", () => {
    render(<InvoiceTable invoices={[]} />);
    expect(screen.getByText(/No invoices yet/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Create Your First Invoice/i }),
    ).toBeInTheDocument();
  });

  it("renders pagination controls when provided", () => {
    const onPageChange = vi.fn();
    const onLimitChange = vi.fn();

    render(
      <InvoiceTable
        invoices={mockInvoices as any}
        pagination={{
          page: 1,
          limit: 20,
          total: 40,
          totalPages: 2,
          onPageChange,
          onLimitChange,
        }}
      />,
    );

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "50" },
    });
    expect(onLimitChange).toHaveBeenCalledWith(50);

    fireEvent.click(screen.getByRole("button", { name: /Next/i }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  // #802 — semantic table structure
  it("renders a <table> element with role=grid and aria-label", () => {
    render(<InvoiceTable invoices={mockInvoices as any} />);
    const table = screen.getByRole("grid", { name: /Invoice Ledger/i });
    expect(table.tagName).toBe("TABLE");
  });

  it("renders column headers as <th scope=col> elements", () => {
    render(<InvoiceTable invoices={mockInvoices as any} />);
    const headers = screen.getAllByRole("columnheader");
    expect(headers).toHaveLength(6);
    expect(headers[0]).toHaveTextContent(/Invoice ID/i);
    expect(headers[1]).toHaveTextContent(/Buyer/i);
    expect(headers[2]).toHaveTextContent(/Face Value/i);
    expect(headers[3]).toHaveTextContent(/Discount/i);
    expect(headers[4]).toHaveTextContent(/Due Date/i);
    expect(headers[5]).toHaveTextContent(/Status/i);
    headers.forEach((h) => expect(h).toHaveAttribute("scope", "col"));
  });

  it("renders invoice data inside <td> cells within <tr> rows", () => {
    render(<InvoiceTable invoices={mockInvoices as any} />);
    const rows = screen.getAllByRole("row");
    // one header row + two data rows
    expect(rows.length).toBeGreaterThanOrEqual(3);
    const cells = screen.getAllByRole("cell");
    expect(cells.length).toBeGreaterThan(0);
  });

  it("marks the active row with aria-selected=true", () => {
    render(<InvoiceTable invoices={mockInvoices as any} activeId="1" />);
    const rows = screen.getAllByRole("row");
    const activeRow = rows.find((r) => r.getAttribute("aria-selected") === "true");
    expect(activeRow).toBeTruthy();
  });
});
