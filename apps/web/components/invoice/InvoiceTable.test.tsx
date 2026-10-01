import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { InvoiceTable } from "./InvoiceTable";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/store/wallet", () => ({
  useWalletStore: vi.fn(() => ({
    address: "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
  })),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: vi.fn(() => ({ isVerified: true })),
}));

vi.mock("@/hooks/useInvoices", () => ({
  useInvoiceActions: () => ({
    listInvoice: vi.fn().mockResolvedValue({}),
    fundInvoice: vi.fn().mockResolvedValue({}),
    shipInvoice: vi.fn().mockResolvedValue({}),
    confirmDelivery: vi.fn().mockResolvedValue({}),
    repayInvoice: vi.fn().mockResolvedValue({}),
    defaultInvoice: vi.fn().mockResolvedValue({}),
  }),
}));

vi.mock("@/store/confirmDialog", () => ({
  useConfirmDialogStore: () => ({
    request: vi.fn(),
  }),
}));

const queryClient = new QueryClient();

const renderWithQueryClient = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
};

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
    renderWithQueryClient(<InvoiceTable invoices={mockInvoices as any} />);
    // Check table rows (desktop view) - use getAllByText since mobile cards also render
    expect(screen.getAllByText(/1,000.00 USDC/)).toHaveLength(2); // table + mobile card
    expect(screen.getAllByText(/2,000.00 USDC/)).toHaveLength(2); // table + mobile card
  });

  it("renders a helpful empty state when no invoices", () => {
    renderWithQueryClient(<InvoiceTable invoices={[]} />);
    expect(screen.getByText(/No invoices yet/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Create Your First Invoice/i }),
    ).toBeInTheDocument();
  });

  it("renders pagination controls when provided", () => {
    const onPageChange = vi.fn();
    const onLimitChange = vi.fn();

    renderWithQueryClient(
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
    renderWithQueryClient(<InvoiceTable invoices={mockInvoices as any} />);
    const table = screen.getByRole("grid", { name: /Invoice Ledger/i });
    expect(table.tagName).toBe("TABLE");
  });

  it("renders column headers as <th scope=col> elements", () => {
    renderWithQueryClient(<InvoiceTable invoices={mockInvoices as any} />);
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
    renderWithQueryClient(<InvoiceTable invoices={mockInvoices as any} />);
    const rows = screen.getAllByRole("row");
    // one header row + two data rows
    expect(rows.length).toBeGreaterThanOrEqual(3);
    const cells = screen.getAllByRole("cell");
    expect(cells.length).toBeGreaterThan(0);
  });

  it("marks the active row with aria-selected=true", () => {
    renderWithQueryClient(
      <InvoiceTable invoices={mockInvoices as any} activeId="1" />,
    );
    const rows = screen.getAllByRole("row");
    const activeRow = rows.find(
      (r) => r.getAttribute("aria-selected") === "true",
    );
    expect(activeRow).toBeTruthy();
  });

  // #803 — roving-tabindex keyboard navigation
  it("only the first data row has tabIndex=0 initially when selectable", () => {
    const onSelectInvoice = vi.fn();
    renderWithQueryClient(
      <InvoiceTable
        invoices={mockInvoices as any}
        onSelectInvoice={onSelectInvoice}
      />,
    );
    const rows = screen.getAllByRole("row");
    // rows[0] is the header row (<tr> in <thead>), rows[1] and rows[2] are data rows
    const dataRows = rows.filter((r) => r.getAttribute("tabindex") !== null);
    const tabZeroRows = dataRows.filter(
      (r) => r.getAttribute("tabindex") === "0",
    );
    expect(tabZeroRows).toHaveLength(1);
  });

  it("data rows have no tabIndex when onSelectInvoice is not provided", () => {
    renderWithQueryClient(<InvoiceTable invoices={mockInvoices as any} />);
    const rows = screen.getAllByRole("row");
    const focusableDataRows = rows.filter(
      (r) => r.getAttribute("tabindex") !== null,
    );
    expect(focusableDataRows).toHaveLength(0);
  });

  it("ArrowDown moves focus to the next row", () => {
    const onSelectInvoice = vi.fn();
    renderWithQueryClient(
      <InvoiceTable
        invoices={mockInvoices as any}
        onSelectInvoice={onSelectInvoice}
      />,
    );
    const rows = screen.getAllByRole("row");
    const firstDataRow = rows.find((r) => r.getAttribute("tabindex") === "0");
    expect(firstDataRow).toBeTruthy();
    fireEvent.keyDown(firstDataRow!, { key: "ArrowDown" });
    const rowsAfter = screen.getAllByRole("row");
    const newFocused = rowsAfter.find(
      (r) => r.getAttribute("tabindex") === "0",
    );
    expect(newFocused).not.toBe(firstDataRow);
  });

  it("Enter key calls onSelectInvoice for the focused row", () => {
    const onSelectInvoice = vi.fn();
    renderWithQueryClient(
      <InvoiceTable
        invoices={mockInvoices as any}
        onSelectInvoice={onSelectInvoice}
      />,
    );
    const rows = screen.getAllByRole("row");
    const firstDataRow = rows.find((r) => r.getAttribute("tabindex") === "0");
    fireEvent.keyDown(firstDataRow!, { key: "Enter" });
    expect(onSelectInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ id: mockInvoices[0].id }),
    );
  });

  // #791 — multi-select for comparison
  describe("multi-select mode", () => {
    it("renders no checkboxes unless selectable is set", () => {
      renderWithQueryClient(<InvoiceTable invoices={mockInvoices as any} />);
      expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
      expect(screen.queryByText(/selected/i)).not.toBeInTheDocument();
    });

    it("adds a checkbox column plus a select-all checkbox when selectable", () => {
      renderWithQueryClient(
        <InvoiceTable invoices={mockInvoices as any} selectable />,
      );

      const headers = screen.getAllByRole("columnheader");
      expect(headers).toHaveLength(7);

      expect(
        screen.getByRole("checkbox", {
          name: /select all invoices on this page/i,
        }),
      ).toBeInTheDocument();
      // One per row, plus the header checkbox.
      expect(screen.getAllByRole("checkbox")).toHaveLength(
        mockInvoices.length + 1,
      );
    });

    it("labels each row checkbox with its invoice id", () => {
      renderWithQueryClient(
        <InvoiceTable invoices={mockInvoices as any} selectable />,
      );
      mockInvoices.forEach((invoice) => {
        expect(
          screen.getByRole("checkbox", {
            name: new RegExp(`select invoice ${invoice.id}$`, "i"),
          }),
        ).toBeInTheDocument();
      });
    });

    it("reports a selection when a row checkbox is toggled", () => {
      const onSelectionChange = vi.fn();
      renderWithQueryClient(
        <InvoiceTable
          invoices={mockInvoices as any}
          selectable
          onSelectionChange={onSelectionChange}
        />,
      );

      fireEvent.click(
        screen.getByRole("checkbox", { name: /select invoice 1$/i }),
      );
      expect(onSelectionChange).toHaveBeenCalledWith(["1"]);
    });

    it("tracks its own selection when selectedIds is not supplied", () => {
      renderWithQueryClient(
        <InvoiceTable invoices={mockInvoices as any} selectable />,
      );

      const rowCheckbox = screen.getByRole("checkbox", {
        name: /select invoice 1$/i,
      }) as HTMLInputElement;

      expect(rowCheckbox.checked).toBe(false);
      fireEvent.click(rowCheckbox);
      expect(rowCheckbox.checked).toBe(true);
      expect(screen.getByText(/1 selected/i)).toBeInTheDocument();
    });

    it("deselects an already-selected row", () => {
      const onSelectionChange = vi.fn();
      renderWithQueryClient(
        <InvoiceTable
          invoices={mockInvoices as any}
          selectable
          selectedIds={["1", "2"]}
          onSelectionChange={onSelectionChange}
        />,
      );

      fireEvent.click(
        screen.getByRole("checkbox", { name: /select invoice 1$/i }),
      );
      expect(onSelectionChange).toHaveBeenCalledWith(["2"]);
    });

    it("honors a controlled selectedIds value", () => {
      renderWithQueryClient(
        <InvoiceTable
          invoices={mockInvoices as any}
          selectable
          selectedIds={["2"]}
          onSelectionChange={vi.fn()}
        />,
      );

      const first = screen.getByRole("checkbox", {
        name: /select invoice 1$/i,
      }) as HTMLInputElement;
      const second = screen.getByRole("checkbox", {
        name: /select invoice 2$/i,
      }) as HTMLInputElement;

      expect(first.checked).toBe(false);
      expect(second.checked).toBe(true);
      expect(screen.getByText(/1 selected/i)).toBeInTheDocument();
    });

    it("select-all selects every invoice on the page", () => {
      const onSelectionChange = vi.fn();
      renderWithQueryClient(
        <InvoiceTable
          invoices={mockInvoices as any}
          selectable
          onSelectionChange={onSelectionChange}
        />,
      );

      fireEvent.click(
        screen.getByRole("checkbox", {
          name: /select all invoices on this page/i,
        }),
      );
      expect(onSelectionChange).toHaveBeenCalledWith(["1", "2"]);
    });

    it("select-all clears only the current page, preserving other pages", () => {
      const onSelectionChange = vi.fn();
      renderWithQueryClient(
        <InvoiceTable
          invoices={mockInvoices as any}
          selectable
          selectedIds={["1", "2", "off-page"]}
          onSelectionChange={onSelectionChange}
        />,
      );

      const selectAll = screen.getByRole("checkbox", {
        name: /select all invoices on this page/i,
      }) as HTMLInputElement;
      expect(selectAll.checked).toBe(true);

      fireEvent.click(selectAll);
      expect(onSelectionChange).toHaveBeenCalledWith(["off-page"]);
    });

    it("select-all is indeterminate when only some rows are selected", () => {
      renderWithQueryClient(
        <InvoiceTable
          invoices={mockInvoices as any}
          selectable
          selectedIds={["1"]}
          onSelectionChange={vi.fn()}
        />,
      );

      const selectAll = screen.getByRole("checkbox", {
        name: /select all invoices on this page/i,
      }) as HTMLInputElement;
      expect(selectAll.checked).toBe(false);
      expect(selectAll.indeterminate).toBe(true);
    });

    it("shows the selected count and clears it from the toolbar", () => {
      const onSelectionChange = vi.fn();
      renderWithQueryClient(
        <InvoiceTable
          invoices={mockInvoices as any}
          selectable
          selectedIds={["1", "2"]}
          onSelectionChange={onSelectionChange}
        />,
      );

      expect(screen.getByText(/2 selected/i)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /clear selection/i }));
      expect(onSelectionChange).toHaveBeenCalledWith([]);
    });

    it("hides Clear selection while nothing is selected", () => {
      renderWithQueryClient(
        <InvoiceTable invoices={mockInvoices as any} selectable />,
      );
      expect(screen.getByText(/0 selected/i)).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /clear selection/i }),
      ).not.toBeInTheDocument();
    });

    it("checkboxes are keyboard-operable", () => {
      const onSelectionChange = vi.fn();
      renderWithQueryClient(
        <InvoiceTable
          invoices={mockInvoices as any}
          selectable
          onSelectionChange={onSelectionChange}
        />,
      );

      const rowCheckbox = screen.getByRole("checkbox", {
        name: /select invoice 1$/i,
      });
      // Native checkboxes stay in the tab order and toggle on Space.
      expect(rowCheckbox).not.toHaveAttribute("tabindex", "-1");
      rowCheckbox.focus();
      expect(document.activeElement).toBe(rowCheckbox);
      fireEvent.click(rowCheckbox);
      expect(onSelectionChange).toHaveBeenCalledWith(["1"]);
    });

    it("toggling a checkbox does not trigger row single-select", () => {
      const onSelectInvoice = vi.fn();
      renderWithQueryClient(
        <InvoiceTable
          invoices={mockInvoices as any}
          selectable
          onSelectInvoice={onSelectInvoice}
          onSelectionChange={vi.fn()}
        />,
      );

      fireEvent.click(
        screen.getByRole("checkbox", { name: /select invoice 1$/i }),
      );
      expect(onSelectInvoice).not.toHaveBeenCalled();
    });

    it("Space on a focused checkbox does not also fire onSelectInvoice", () => {
      const onSelectInvoice = vi.fn();
      renderWithQueryClient(
        <InvoiceTable
          invoices={mockInvoices as any}
          selectable
          onSelectInvoice={onSelectInvoice}
          onSelectionChange={vi.fn()}
        />,
      );

      const rowCheckbox = screen.getByRole("checkbox", {
        name: /select invoice 1$/i,
      });
      // The keydown bubbles to the <tr>, which must ignore it.
      fireEvent.keyDown(rowCheckbox, { key: " ", bubbles: true });
      expect(onSelectInvoice).not.toHaveBeenCalled();
    });

    it("marks selected rows with aria-selected in multi-select mode", () => {
      renderWithQueryClient(
        <InvoiceTable
          invoices={mockInvoices as any}
          selectable
          selectedIds={["2"]}
          onSelectionChange={vi.fn()}
        />,
      );

      const selectedRows = screen
        .getAllByRole("row")
        .filter((r) => r.getAttribute("aria-selected") === "true");
      expect(selectedRows).toHaveLength(1);
    });

    it("keeps row keyboard navigation working alongside checkboxes", () => {
      const onSelectInvoice = vi.fn();
      renderWithQueryClient(
        <InvoiceTable
          invoices={mockInvoices as any}
          selectable
          onSelectInvoice={onSelectInvoice}
          onSelectionChange={vi.fn()}
        />,
      );

      const firstDataRow = screen
        .getAllByRole("row")
        .find((r) => r.getAttribute("tabindex") === "0");
      expect(firstDataRow).toBeTruthy();
      fireEvent.keyDown(firstDataRow!, { key: "Enter" });
      expect(onSelectInvoice).toHaveBeenCalledWith(
        expect.objectContaining({ id: "1" }),
      );
    });
  });
});
