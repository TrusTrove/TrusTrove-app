import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { InvoiceForm } from "./InvoiceForm";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/hooks/useRole", () => ({
  useRole: () => ({ role: "issuer" }),
}));
vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({
    address: "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
  }),
}));
vi.mock("@/hooks/useInvoices", () => ({
  useInvoices: () => ({
    createInvoice: vi.fn().mockResolvedValue({
      invoice_id: "abcd",
      transaction_hash: "txhash",
    }),
    listInvoice: vi.fn().mockResolvedValue({}),
    isCreating: false,
  }),
}));

const queryClient = new QueryClient();

const renderWithQueryClient = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
};

describe("InvoiceForm", () => {
  beforeEach(() => {
    queryClient.clear();
  });
  it("renders the first step of the wizard", () => {
    renderWithQueryClient(<InvoiceForm />);
    expect(screen.getByText(/Buyer Wallet Address/i)).toBeInTheDocument();
    expect(screen.getByText(/Face Value/i)).toBeInTheDocument();
  });

  it("validates form fields before proceeding", async () => {
    renderWithQueryClient(<InvoiceForm />);
    const buyerInput = screen.getByPlaceholderText(/GBBD47IF6L/i);
    fireEvent.change(buyerInput, { target: { value: "invalid_address" } });

    const nextButton = screen.getByText(/REVIEW FINANCING TERMS/i);
    fireEvent.submit(nextButton);
    expect(
      await screen.findByText(/Buyer must be a valid Stellar public key/i),
    ).toBeInTheDocument();
  });

  it("proceeds to step 2 when valid and shows simulation state", async () => {
    renderWithQueryClient(<InvoiceForm />);
    const buyerInput = screen.getByPlaceholderText(/GBBD47IF6L/i);
    const valueInput = screen.getByPlaceholderText(/50,000.00/i);

    fireEvent.change(buyerInput, {
      target: {
        value: "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      },
    });
    fireEvent.change(valueInput, { target: { value: "1000" } });

    const nextButton = screen.getByText(/REVIEW FINANCING TERMS/i);
    fireEvent.click(nextButton);

    expect(await screen.findByText(/Invoice Face Value/i)).toBeInTheDocument();
    expect(screen.getByText(/Net Payout Today:/i)).toBeInTheDocument();
  });

  it("returns to step 1 when Edit is clicked", async () => {
    renderWithQueryClient(<InvoiceForm />);
    fireEvent.change(screen.getByPlaceholderText(/GBBD47IF6L/i), {
      target: {
        value: "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      },
    });
    fireEvent.change(screen.getByPlaceholderText(/50,000.00/i), {
      target: { value: "1000" },
    });

    fireEvent.click(screen.getByText(/REVIEW FINANCING TERMS/i));
    expect(await screen.findByText(/Invoice Face Value/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/EDIT/i));
    expect(await screen.findByText(/Buyer Wallet Address/i)).toBeInTheDocument();
  });
});
