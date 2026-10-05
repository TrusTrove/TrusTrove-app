import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AnalyticsClient, { formatCompactUsdc } from "./AnalyticsClient";
import type { ProtocolStats } from "@/lib/api";

const { useStatsMock } = vi.hoisted(() => ({ useStatsMock: vi.fn() }));

vi.mock("@/hooks/useStats", () => ({ useStats: useStatsMock }));
vi.mock("@/components/shared/PageLayout", () => ({
  PageLayout: ({ children }: { children: unknown }) => children,
}));
vi.mock("@/components/shared/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: unknown }) => children,
}));
vi.mock("@/components/shared/PoolPerformanceChart", () => ({
  PoolPerformanceChart: () => null,
}));

const stats: ProtocolStats = {
  total_usdc_financed: "1250000",
  pool_utilization_bps: 7250,
  average_yield_bps: 812,
  registered_issuers: 12,
  total_invoices: 1200,
  active_invoice_count: 300,
  total_repaid: 850,
  total_defaulted: 50,
};

describe("AnalyticsClient", () => {
  beforeEach(() => {
    useStatsMock.mockReset();
  });

  it("renders all eight statistic labels and formatted values", () => {
    useStatsMock.mockReturnValue({ stats, isLoading: false, error: null });
    render(<AnalyticsClient />);

    for (const label of [
      "Total USDC Financed",
      "Pool Utilization",
      "Average Yield",
      "Registered Issuers",
      "Total Invoices",
      "Active Invoices",
      "Invoices Repaid",
      "Invoices Defaulted",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    expect(screen.getByText("72.5%")).toBeInTheDocument();
    expect(screen.getByText("8.12%")).toBeInTheDocument();
    expect(screen.getByText("1,200")).toBeInTheDocument();
  });

  it("shows a skeleton for each statistic while loading", () => {
    useStatsMock.mockReturnValue({
      stats: undefined,
      isLoading: true,
      error: null,
    });
    const { container } = render(<AnalyticsClient />);

    expect(container.querySelectorAll(".h-7.w-24")).toHaveLength(8);
  });

  it("shows an em dash for every tile and an error note when stats fail", () => {
    useStatsMock.mockReturnValue({
      stats: undefined,
      isLoading: false,
      error: new Error("offline"),
    });
    render(<AnalyticsClient />);

    expect(screen.getAllByText("—")).toHaveLength(8);
    expect(
      screen.getByText(/Live stats are temporarily unavailable/),
    ).toBeInTheDocument();
  });

  it.each(["abc", undefined])(
    "returns null for invalid USDC amount %s",
    (value) => {
      expect(formatCompactUsdc(value)).toBeNull();
    },
  );

  it.each(["abc", undefined])(
    "renders an em dash for USDC amount %s",
    (total_usdc_financed) => {
      useStatsMock.mockReturnValue({
        stats: { ...stats, total_usdc_financed },
        isLoading: false,
        error: null,
      });
      render(<AnalyticsClient />);

      expect(screen.getAllByText("—")).toHaveLength(1);
    },
  );
});
