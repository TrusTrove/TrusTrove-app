import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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
    isLoading: false,
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

const queryClient = new QueryClient();

import Marketplace from "@/app/marketplace/page";

describe("Marketplace discount slider accessibility", () => {
  it("has correct ARIA attributes matching the established pattern", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <Marketplace />
      </QueryClientProvider>,
    );

    const slider = screen.getByRole("slider");

    // Verify aria-label
    expect(slider).toHaveAttribute("aria-label", "Maximum discount rate");

    // Verify aria-valuenow is bound to the current state (default: "500")
    expect(slider).toHaveAttribute("aria-valuenow", "500");

    // Verify aria-valuemin/max match the input's min/max
    expect(slider).toHaveAttribute("aria-valuemin", "50");
    expect(slider).toHaveAttribute("aria-valuemax", "500");
  });

  it("aria-valuenow updates when slider value changes", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <Marketplace />
      </QueryClientProvider>,
    );

    const slider = screen.getByRole("slider");
    expect(slider).toHaveAttribute("aria-valuenow", "500");

    // Simulate changing the slider value
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;
    nativeInputValueSetter?.call(slider, "200");
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    slider.dispatchEvent(new Event("change", { bubbles: true }));

    expect(slider).toHaveAttribute("aria-valuenow", "200");
  });

  it("passes axe-core accessibility check", async () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <Marketplace />
      </QueryClientProvider>,
    );

    const results = await axe(container, {
      runOnly: {
        type: "rule",
        values: ["aria-required-attr", "aria-valid-attr-value"],
      },
    });
    expect(results).toHaveNoViolations();
  });
});
