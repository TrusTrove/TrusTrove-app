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
});
