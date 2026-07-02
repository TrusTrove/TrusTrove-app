import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { InvoiceCard } from "./InvoiceCard";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock the hooks
vi.mock("@/store/wallet", () => ({
  useWalletStore: vi.fn(() => ({
    address: "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
  })),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: vi.fn(() => ({ isVerified: true })),
}));

vi.mock("@/hooks/useInvoices", () => ({
  useInvoices: () => ({
    listInvoice: vi.fn().mockResolvedValue({}),
    fundInvoice: vi.fn().mockResolvedValue({}),
    shipInvoice: vi.fn().mockResolvedValue({}),
    confirmDelivery: vi.fn().mockResolvedValue({}),
    repayInvoice: vi.fn().mockResolvedValue({}),
    defaultInvoice: vi.fn().mockResolvedValue({}),
  }),
}));

const mockInvoice = {
  id: "abcd",
  status: "Created",
  issuer: "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
  buyer: "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
  faceValue: 10000000000n, // 1000.00 USDC
  asset: "USDC",
  discountBps: 0,
  fundedAmount: 0n,
  dueDate: 1234567890,
};

const queryClient = new QueryClient();

const renderWithQueryClient = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
};

describe("InvoiceCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("renders invoice details correctly", () => {
    renderWithQueryClient(<InvoiceCard invoice={mockInvoice as any} />);
    expect(screen.getByText(/1,000.00 USDC/)).toBeInTheDocument();
  });

  it("renders correct action buttons for created status (issuer)", () => {
    renderWithQueryClient(
      <InvoiceCard
        invoice={{ ...mockInvoice, status: "Created" } as any}
        role="issuer"
      />,
    );
    // Issuer can list for financing when created
    expect(screen.getByText(/Configure financing terms/i)).toBeInTheDocument();
  });

  it("renders correct action buttons for listed status (lp)", () => {
    renderWithQueryClient(
      <InvoiceCard
        invoice={{ ...mockInvoice, status: "Listed" } as any}
        role="lp"
      />,
    );
    // LP can fund when listed
    expect(screen.getByText(/FUND INVOICE/i)).toBeInTheDocument();
  });

  it("renders correct action buttons for funded status (issuer)", () => {
    renderWithQueryClient(
      <InvoiceCard
        invoice={{ ...mockInvoice, status: "Funded" } as any}
        role="issuer"
      />,
    );
    // Issuer can mark shipped when funded
    expect(screen.getByText(/MARK GOODS SHIPPED/i)).toBeInTheDocument();
  });

  it("renders confirm delivery button for active status and buyer role", () => {
    renderWithQueryClient(
      <InvoiceCard
        invoice={{ ...mockInvoice, status: "Active", buyerConfirmed: false } as any}
        role="buyer"
      />,
    );
    expect(screen.getByText(/CONFIRM DELIVERY/i)).toBeInTheDocument();
  });

  it("renders repay button for confirmed status and buyer role", () => {
    renderWithQueryClient(
      <InvoiceCard
        invoice={{ ...mockInvoice, status: "Confirmed" } as any}
        role="buyer"
      />,
    );
    expect(screen.getByText(/REPAY INVOICE/i)).toBeInTheDocument();
  });

  it("opens list terms form when configure financing terms is clicked", () => {
    renderWithQueryClient(
      <InvoiceCard invoice={{ ...mockInvoice, status: "Created" } as any} role="issuer" />,
    );
    fireEvent.click(screen.getByText(/Configure financing terms/i));
    expect(screen.getByText(/Discount Basis Points/i)).toBeInTheDocument();
  });

  it("renders correct action buttons for shipped status (buyer)", () => {
    renderWithQueryClient(
      <InvoiceCard
        invoice={{ ...mockInvoice, status: "Active" } as any}
        role="buyer"
      />,
    );
    // Buyer can confirm delivery when shipped (in contract it's Active)
    expect(screen.getByText(/CONFIRM DELIVERY/i)).toBeInTheDocument();
  });

  it("renders correct action buttons for delivered status (buyer)", () => {
    renderWithQueryClient(
      <InvoiceCard
        invoice={{ ...mockInvoice, status: "Confirmed" } as any}
        role="buyer"
      />,
    );
    // Buyer can repay when delivered (in contract it's Confirmed)
    expect(screen.getByText(/REPAY INVOICE/i)).toBeInTheDocument();
  });
});
