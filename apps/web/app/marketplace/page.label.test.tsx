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

describe("Marketplace filter labels accessibility", () => {
  it("Min Value and Max Value labels are associated with their inputs", async () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <Marketplace />
      </QueryClientProvider>,
    );

    const minValueLabel = screen.getByText("Min Value");
    const maxValueLabel = screen.getByText("Max Value");

    // Verify they are <label> elements with htmlFor
    expect(minValueLabel.tagName).toBe("LABEL");
    expect(maxValueLabel.tagName).toBe("LABEL");
    expect(minValueLabel).toHaveAttribute("for");
    expect(maxValueLabel).toHaveAttribute("for");

    const minValueInput = screen.getByPlaceholderText("e.g. 5000");
    const maxValueInput = screen.getByPlaceholderText("e.g. 50000");

    // Verify htmlFor matches input id
    expect(minValueLabel.getAttribute("for")).toBe(
      minValueInput.getAttribute("id"),
    );
    expect(maxValueLabel.getAttribute("for")).toBe(
      maxValueInput.getAttribute("id"),
    );

    // Run axe-core check scoped to the label rule —
    // include only the min/max value filter containers to avoid
    // pre-existing violations on other elements (e.g. select-name).
    const results = await axe(container, {
      runOnly: { type: "rule", values: ["label"] },
    });
    // Filter to only violations on our target inputs
    const minInputViolations = results.violations.filter((v: any) =>
      v.nodes.some((n: any) =>
        n.target.some(
          (t: any) =>
            typeof t === "string" && t.includes("#marketplace-min-value"),
        ),
      ),
    );
    const maxInputViolations = results.violations.filter((v: any) =>
      v.nodes.some((n: any) =>
        n.target.some(
          (t: any) =>
            typeof t === "string" && t.includes("#marketplace-max-value"),
        ),
      ),
    );
    expect(minInputViolations).toHaveLength(0);
    expect(maxInputViolations).toHaveLength(0);
  });

  it("Min Value label htmlFor matches input id for click-to-focus", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <Marketplace />
      </QueryClientProvider>,
    );

    const label = screen.getByText("Min Value");
    const input = screen.getByPlaceholderText("e.g. 5000");
    // jsdom doesn't fully simulate label-click-to-focus,
    // but correct htmlFor ensures the browser will.
    expect(label).toHaveAttribute("for", input.id);
    expect(input).toHaveAttribute("id");
  });

  it("Max Value label htmlFor matches input id for click-to-focus", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <Marketplace />
      </QueryClientProvider>,
    );

    const label = screen.getByText("Max Value");
    const input = screen.getByPlaceholderText("e.g. 50000");
    expect(label).toHaveAttribute("for", input.id);
    expect(input).toHaveAttribute("id");
  });
});
