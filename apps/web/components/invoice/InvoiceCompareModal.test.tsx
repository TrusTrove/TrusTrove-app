import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InvoiceCompareModal } from "./InvoiceCompareModal";
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

/** `n` invoices with distinct ids and face values, so columns are traceable. */
const makeColumnSet = (n: number): Invoice[] =>
  Array.from({ length: n }, (_, index) =>
    makeInvoice({
      id: `invoice-${index + 1}`,
      faceValue: BigInt((index + 1) * 1_000_000_000),
    }),
  );

/** The 4 invoice ids currently inside the comparison window. */
function visibleInvoiceIds(): string[] {
  return cellsFor("Invoice ID");
}

/** Accessible labels of the invoice columns currently inside the window. */
function visibleColumnLabels(): string[] {
  return screen
    .getAllByRole("columnheader")
    .map((th) => /Invoice \d+/.exec(th.textContent ?? "")?.[0])
    .filter((text): text is string => text !== undefined);
}

/** Text of the value cells in the comparison row headed by `label`. */
function cellsFor(label: string): string[] {
  const row = screen.getByRole("rowheader", { name: label }).parentElement;
  return row
    ? within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent ?? "")
    : [];
}

describe("InvoiceCompareModal dialog semantics", () => {
  it("renders a labelled modal dialog", () => {
    const onClose = vi.fn();
    render(
      <InvoiceCompareModal invoices={makeColumnSet(2)} onClose={onClose} />,
    );

    const dialog = screen.getByRole("dialog", { name: "Invoice Comparison" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <InvoiceCompareModal invoices={makeColumnSet(2)} onClose={onClose} />,
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalled();
  });

  it("closes when the backdrop is clicked", () => {
    const onClose = vi.fn();
    render(
      <InvoiceCompareModal invoices={makeColumnSet(2)} onClose={onClose} />,
    );

    fireEvent.click(screen.getByRole("dialog"));

    expect(onClose).toHaveBeenCalled();
  });

  it("keeps the dialog open when the panel is clicked", () => {
    const onClose = vi.fn();
    render(
      <InvoiceCompareModal invoices={makeColumnSet(2)} onClose={onClose} />,
    );

    fireEvent.click(screen.getByText("Invoice Comparison"));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes from the explicit close button", () => {
    const onClose = vi.fn();
    render(
      <InvoiceCompareModal invoices={makeColumnSet(2)} onClose={onClose} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close comparison" }));

    expect(onClose).toHaveBeenCalled();
  });
});

describe("InvoiceCompareModal column pagination", () => {
  const nextButton = () =>
    screen.getByRole("button", { name: "Show next invoice" });
  const prevButton = () =>
    screen.getByRole("button", { name: "Show previous invoice" });

  it("shows the first four columns and disables previous at the start", () => {
    render(
      <InvoiceCompareModal invoices={makeColumnSet(6)} onClose={vi.fn()} />,
    );

    expect(visibleColumnLabels()).toEqual([
      "Invoice 1",
      "Invoice 2",
      "Invoice 3",
      "Invoice 4",
    ]);
    expect(visibleInvoiceIds()).toEqual([
      "invoice-1",
      "invoice-2",
      "invoice-3",
      "invoice-4",
    ]);
    expect(cellsFor("Face Value")).toEqual([
      "100.00 USDC",
      "200.00 USDC",
      "300.00 USDC",
      "400.00 USDC",
    ]);
    expect(screen.getByText(/^Showing 1–4 of 6$/)).toBeInTheDocument();
    expect(prevButton()).toBeDisabled();
    expect(nextButton()).toBeEnabled();
  });

  it("slides one column per click and disables next at the last window", () => {
    render(
      <InvoiceCompareModal invoices={makeColumnSet(6)} onClose={vi.fn()} />,
    );

    fireEvent.click(nextButton());

    expect(visibleInvoiceIds()).toEqual([
      "invoice-2",
      "invoice-3",
      "invoice-4",
      "invoice-5",
    ]);
    expect(visibleColumnLabels()).toEqual([
      "Invoice 2",
      "Invoice 3",
      "Invoice 4",
      "Invoice 5",
    ]);
    expect(cellsFor("Face Value")).toEqual([
      "200.00 USDC",
      "300.00 USDC",
      "400.00 USDC",
      "500.00 USDC",
    ]);
    expect(screen.getByText(/^Showing 2–5 of 6$/)).toBeInTheDocument();

    fireEvent.click(nextButton());

    expect(visibleInvoiceIds()).toEqual([
      "invoice-3",
      "invoice-4",
      "invoice-5",
      "invoice-6",
    ]);
    expect(screen.getByText(/^Showing 3–6 of 6$/)).toBeInTheDocument();
    expect(nextButton()).toBeDisabled();
    expect(prevButton()).toBeEnabled();

    // Clicking past the end clamps instead of showing an empty window.
    fireEvent.click(nextButton());
    expect(visibleInvoiceIds()).toEqual([
      "invoice-3",
      "invoice-4",
      "invoice-5",
      "invoice-6",
    ]);

    fireEvent.click(prevButton());
    expect(visibleInvoiceIds()).toEqual([
      "invoice-2",
      "invoice-3",
      "invoice-4",
      "invoice-5",
    ]);
  });

  it("labels each column with its position in the full selection", () => {
    render(
      <InvoiceCompareModal invoices={makeColumnSet(6)} onClose={vi.fn()} />,
    );

    expect(screen.getByText("#1 of 6")).toBeInTheDocument();
    expect(screen.getByText("#4 of 6")).toBeInTheDocument();

    fireEvent.click(nextButton());

    expect(screen.queryByText("#1 of 6")).not.toBeInTheDocument();
    expect(screen.getByText("#5 of 6")).toBeInTheDocument();
  });

  it("hides the paging controls for four or fewer invoices", () => {
    render(
      <InvoiceCompareModal invoices={makeColumnSet(4)} onClose={vi.fn()} />,
    );

    expect(
      screen.queryByRole("button", { name: "Show next invoice" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Show previous invoice" }),
    ).toBeNull();
    expect(screen.queryByText(/^Showing /)).toBeNull();
    expect(screen.queryByText(/#1 of 4/)).toBeNull();
    expect(visibleColumnLabels()).toHaveLength(4);
    expect(visibleInvoiceIds()).toEqual([
      "invoice-1",
      "invoice-2",
      "invoice-3",
      "invoice-4",
    ]);
  });

  it("shows the tail window for a selection that is not a multiple of four", () => {
    render(
      <InvoiceCompareModal invoices={makeColumnSet(5)} onClose={vi.fn()} />,
    );

    fireEvent.click(nextButton());

    expect(visibleInvoiceIds()).toEqual([
      "invoice-2",
      "invoice-3",
      "invoice-4",
      "invoice-5",
    ]);
    expect(screen.getByText(/^Showing 2–5 of 5$/)).toBeInTheDocument();
    expect(nextButton()).toBeDisabled();
  });
});

describe("InvoiceCompareModal comparison rows", () => {
  const FIELD_LABELS = [
    "Invoice ID",
    "Issuer",
    "Buyer",
    "Face Value",
    "Asset",
    "Discount Rate",
    "Funded Amount",
    "Due Date",
    "Created",
    "Status",
  ];

  it("renders one headed row per comparison field", () => {
    render(
      <InvoiceCompareModal invoices={makeColumnSet(2)} onClose={vi.fn()} />,
    );

    for (const label of FIELD_LABELS) {
      expect(
        screen.getByRole("rowheader", { name: label }),
      ).toBeInTheDocument();
    }
  });

  it("renders one value cell per visible invoice in every row", () => {
    render(
      <InvoiceCompareModal invoices={makeColumnSet(4)} onClose={vi.fn()} />,
    );

    // 10 field rows x 4 columns.
    expect(screen.getAllByRole("cell")).toHaveLength(40);
    for (const label of FIELD_LABELS) {
      expect(cellsFor(label)).toHaveLength(4);
    }
  });

  it("renders each field's value from the invoice", () => {
    render(
      <InvoiceCompareModal
        invoices={[makeInvoice({ id: "abc123", fundedAmount: 25_000_000n })]}
        onClose={vi.fn()}
      />,
    );

    expect(cellsFor("Invoice ID")).toEqual(["abc123"]);
    expect(cellsFor("Issuer")).toEqual([issuer]);
    expect(cellsFor("Buyer")).toEqual([buyer]);
    expect(cellsFor("Face Value")).toEqual(["100.00 USDC"]);
    expect(cellsFor("Asset")).toEqual(["USDC"]);
    expect(cellsFor("Discount Rate")).toEqual(["5.00%"]);
    expect(cellsFor("Funded Amount")).toEqual(["2.50 USDC"]);
    expect(cellsFor("Due Date")).toEqual([
      new Date(1_735_689_600 * 1000).toLocaleDateString(),
    ]);
    expect(cellsFor("Created")).toEqual([
      new Date(1_735_430_400 * 1000).toLocaleString(),
    ]);
    expect(cellsFor("Status")).toEqual(["CREATED"]);
  });

  it("renders the per-field value for each column of the row", () => {
    render(
      <InvoiceCompareModal
        invoices={[
          makeInvoice({
            id: "invoice-1",
            discountBps: 0,
            status: "Created",
          }),
          makeInvoice({
            id: "invoice-2",
            discountBps: 1234,
            status: "Defaulted",
          }),
        ]}
        onClose={vi.fn()}
      />,
    );

    expect(cellsFor("Discount Rate")).toEqual(["—", "12.34%"]);
    expect(cellsFor("Status")).toEqual(["CREATED", "DEFAULTED"]);
    expect(cellsFor("Invoice ID")).toEqual(["invoice-1", "invoice-2"]);
  });
});
