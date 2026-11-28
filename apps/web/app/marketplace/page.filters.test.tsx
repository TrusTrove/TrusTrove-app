import React from "react";
import { screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "@/test-utils/renderWithProviders";

vi.mock("@/store/wallet", () => ({
  useWalletStore: (selector: any) => {
    const state = {
      connected: false,
      address: null,
      role: null,
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: vi.fn(() => ({
    isVerified: false,
    profile: null,
    isProfileLoading: false,
    isVerifiedLoading: false,
  })),
}));

// Face values in stroops: 0.1, 1 and 10 units.
vi.mock("@/hooks/useInvoices", () => ({
  useInvoiceList: vi.fn(() => ({
    invoices: [
      { id: 1, faceValue: 1_000_000n, discountBps: 100, status: "Pending" },
      { id: 2, faceValue: 10_000_000n, discountBps: 100, status: "Pending" },
      { id: 3, faceValue: 100_000_000n, discountBps: 100, status: "Pending" },
    ],
    isLoading: false,
    total: 3,
    totalPages: 1,
  })),
}));

vi.mock("@/hooks/usePool", () => ({
  usePool: vi.fn(() => ({
    stats: { availableLiquidity: 0n },
    isStatsLoading: false,
  })),
}));

vi.mock("@/components/shared/PageLayout", () => ({
  PageLayout: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/components/invoice/InvoiceTable", () => ({
  InvoiceTable: ({ invoices }: { invoices: { id: number }[] }) => (
    <ul data-testid="invoice-table">
      {invoices.map((inv) => (
        <li key={inv.id}>invoice-{inv.id}</li>
      ))}
    </ul>
  ),
}));

vi.mock("@/components/invoice/InvoiceCard", () => ({
  InvoiceCard: () => null,
}));

import Marketplace from "@/app/marketplace/page";

const visibleIds = () =>
  Array.from(screen.getByTestId("invoice-table").querySelectorAll("li")).map(
    (li) => li.textContent,
  );

describe("Marketplace value filters", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("does not crash when Min Value has more than 7 decimals", () => {
    renderWithProviders(<Marketplace />);

    fireEvent.change(screen.getByLabelText("Min Value"), {
      target: { value: "0.123456789" },
    });

    // 0.123456789 rounds to 1_234_568 stroops: only the 0.1 invoice drops out.
    expect(visibleIds()).toEqual(["invoice-3", "invoice-2"]);
  });

  it("does not crash when Max Value has more than 7 decimals", () => {
    renderWithProviders(<Marketplace />);

    fireEvent.change(screen.getByLabelText("Max Value"), {
      target: { value: "5.12345678" },
    });

    expect(visibleIds()).toEqual(["invoice-2", "invoice-1"]);
  });

  it("ignores negative input instead of filtering or throwing", () => {
    renderWithProviders(<Marketplace />);

    fireEvent.change(screen.getByLabelText("Max Value"), {
      target: { value: "-5" },
    });

    expect(visibleIds()).toEqual(["invoice-3", "invoice-2", "invoice-1"]);
  });
});
