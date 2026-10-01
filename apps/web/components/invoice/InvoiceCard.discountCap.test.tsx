import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { InvoiceCard } from "./InvoiceCard";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MAX_DISCOUNT_BPS } from "@/lib/validation";

const listInvoice = vi.fn().mockResolvedValue({});

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
    listInvoice,
    fundInvoice: vi.fn().mockResolvedValue({}),
    shipInvoice: vi.fn().mockResolvedValue({}),
    confirmDelivery: vi.fn().mockResolvedValue({}),
    repayInvoice: vi.fn().mockResolvedValue({}),
    defaultInvoice: vi.fn().mockResolvedValue({}),
  }),
}));

vi.mock("@/store/confirmDialog", () => ({
  useConfirmDialogStore: vi.fn(() => ({ request: vi.fn() })),
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

function openListForm() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <InvoiceCard invoice={mockInvoice as any} role="issuer" />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByText(/Configure financing terms/i));
  return screen.getByDisplayValue("200") as HTMLInputElement;
}

async function submit(input: HTMLInputElement, value: string) {
  fireEvent.change(input, { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: /LIST TERMS/i }));
}

// #755 — the form used to accept up to 10,000 bps while the contract caps
// list_for_financing at 5,000, so 5001-10000 burned a signed transaction.
describe("InvoiceCard discount basis points cap", () => {
  beforeEach(() => {
    listInvoice.mockClear();
  });

  it("rejects 5001 without calling listInvoice", async () => {
    const input = openListForm();
    await submit(input, "5001");

    await waitFor(() =>
      expect(
        screen.getByText(/must be between 1 and 5,000/i),
      ).toBeInTheDocument(),
    );
    expect(listInvoice).not.toHaveBeenCalled();
  });

  it("rejects representative values across 5001-10000", async () => {
    for (const value of ["5001", "6000", "7500", "9999", "10000"]) {
      listInvoice.mockClear();
      const input = openListForm();
      await submit(input, value);

      await waitFor(() =>
        expect(
          screen.getByText(/must be between 1 and 5,000/i),
        ).toBeInTheDocument(),
      );
      expect(listInvoice).not.toHaveBeenCalled();
      cleanup();
    }
  });

  it("states the real 50% ceiling in the error message", async () => {
    const input = openListForm();
    await submit(input, "9000");

    await waitFor(() =>
      expect(
        screen.getByText(/must be between 1 and 5,000 \(50%\)/i),
      ).toBeInTheDocument(),
    );
    // The old copy advertised a 10,000 bps / 100% limit that never existed.
    expect(screen.queryByText(/10,000/)).not.toBeInTheDocument();
    expect(screen.queryByText(/100%\)/)).not.toBeInTheDocument();
  });

  it("accepts the boundary value 5000", async () => {
    const input = openListForm();
    await submit(input, "5000");

    await waitFor(() =>
      expect(listInvoice).toHaveBeenCalledWith({
        invoiceId: mockInvoice.id,
        discountBps: MAX_DISCOUNT_BPS,
      }),
    );
  });

  it("still accepts an ordinary discount", async () => {
    const input = openListForm();
    await submit(input, "250");

    await waitFor(() =>
      expect(listInvoice).toHaveBeenCalledWith({
        invoiceId: mockInvoice.id,
        discountBps: 250,
      }),
    );
  });

  it("rejects zero", async () => {
    const input = openListForm();
    await submit(input, "0");

    await waitFor(() =>
      expect(
        screen.getByText(/must be between 1 and 5,000/i),
      ).toBeInTheDocument(),
    );
    expect(listInvoice).not.toHaveBeenCalled();
  });

  it("constrains the number input to the contract ceiling", () => {
    const input = openListForm();
    expect(input).toHaveAttribute("max", String(MAX_DISCOUNT_BPS));
    expect(input).toHaveAttribute("min", "1");
  });
});
