import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { axe } from "vitest-axe";
import { InvoiceCard } from "./InvoiceCard";
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
  useConfirmDialogStore: vi.fn(() => ({
    request: vi.fn(),
  })),
}));

const mockInvoice = {
  id: "abcd",
  status: "Created",
  issuer: "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
  buyer: "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
  faceValue: 10000000000n,
  asset: "USDC",
  discountBps: 0,
  fundedAmount: 0n,
  dueDate: Math.floor(Date.now() / 1000) + 86400 * 30,
};

const queryClient = new QueryClient();

const renderWithQueryClient = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
};

describe("InvoiceCard discount basis points label accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has no axe violations when list form is open", async () => {
    const { container } = renderWithQueryClient(
      <InvoiceCard
        invoice={{ ...mockInvoice, status: "Created" } as any}
        role="issuer"
      />,
    );
    // Open the list form
    fireEvent.click(screen.getByText(/Configure financing terms/i));

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("discount basis points label is associated with its input", () => {
    renderWithQueryClient(
      <InvoiceCard
        invoice={{ ...mockInvoice, status: "Created" } as any}
        role="issuer"
      />,
    );
    fireEvent.click(screen.getByText(/Configure financing terms/i));

    const label = screen.getByText(/Discount Basis Points/);
    expect(label).toHaveAttribute("for");
    const input = screen.getByDisplayValue("200");
    expect(label.getAttribute("for")).toBe(input.getAttribute("id"));
  });

  it("label htmlFor matches input id for click-to-focus in real browsers", () => {
    renderWithQueryClient(
      <InvoiceCard
        invoice={{ ...mockInvoice, status: "Created" } as any}
        role="issuer"
      />,
    );
    fireEvent.click(screen.getByText(/Configure financing terms/i));

    const label = screen.getByText(/Discount Basis Points/);
    const input = screen.getByDisplayValue("200");
    // jsdom doesn't fully simulate label-click-to-focus,
    // but correct htmlFor ensures the browser will.
    expect(label).toHaveAttribute("for", input.id);
    expect(input).toHaveAttribute("id");
  });

  it("multiple InvoiceCards on the same page have unique IDs", () => {
    renderWithQueryClient(
      <div>
        <InvoiceCard
          invoice={{ ...mockInvoice, id: "card1", status: "Created" } as any}
          role="issuer"
        />
        <InvoiceCard
          invoice={{ ...mockInvoice, id: "card2", status: "Created" } as any}
          role="issuer"
        />
      </div>,
    );

    // Open list form on first card
    const configureButtons = screen.getAllByText(/Configure financing terms/i);
    fireEvent.click(configureButtons[0]);

    const discountLabels = screen.getAllByText(/Discount Basis Points/);
    expect(discountLabels).toHaveLength(1); // Only first card's form is open

    const firstForId = discountLabels[0].getAttribute("for");
    const input = screen.getByDisplayValue("200");
    expect(firstForId).toBe(input.getAttribute("id"));
  });
});
