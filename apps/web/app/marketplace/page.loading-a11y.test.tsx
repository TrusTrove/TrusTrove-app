import React from "react";
import { screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/renderWithProviders";

// #990: the marketplace's "Syncing..." label and the result count were purely
// visual, so filter changes and in-flight refetches went unannounced.
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

vi.mock("@/hooks/useInvoices", () => ({
  useInvoiceList: vi.fn(() => ({
    invoices: [],
    isLoading: true,
    total: 0,
    totalPages: 0,
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

vi.mock("@/components/shared/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("@/components/invoice/InvoiceTable", () => ({
  InvoiceTable: () => null,
}));

vi.mock("@/components/invoice/InvoiceCard", () => ({
  InvoiceCard: () => null,
}));

import Marketplace from "@/app/marketplace/page";

describe("Marketplace loading announcements", () => {
  it("announces the syncing label as a polite status", () => {
    renderWithProviders(<Marketplace />);

    const syncing = screen.getByText("Syncing...");
    expect(syncing).toHaveAttribute("role", "status");
  });

  it("puts the result count in a polite live region", () => {
    renderWithProviders(<Marketplace />);

    const heading = screen.getByRole("heading", {
      name: "Available Invoices (0)",
    });
    expect(heading).toHaveAttribute("aria-live", "polite");
    expect(heading).toHaveAttribute("aria-atomic", "true");
  });
});
