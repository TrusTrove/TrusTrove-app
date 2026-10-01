import React from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi } from "vitest";
import { PoolPerformanceChart } from "./PoolPerformanceChart";
import type { PoolSnapshot } from "@/types";

// ResponsiveContainer depends on ResizeObserver/layout and renders nothing
// in jsdom, so replace it with a fixed-size passthrough that forwards
// explicit dimensions to the inner chart (mirrors recharts' prop injection).
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({
      children,
    }: {
      children: React.ReactElement<{ width?: number; height?: number }>;
    }) => <>{React.cloneElement(children, { width: 600, height: 320 })}</>,
  };
});

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

const snapshots: PoolSnapshot[] = [
  {
    timestamp: 1700000000,
    utilizationRateBps: 5000,
    totalYieldDistributed: "25000000",
  },
  {
    timestamp: 1700086400,
    utilizationRateBps: 7500,
    totalYieldDistributed: "50000000",
  },
];

describe("PoolPerformanceChart", () => {
  it("renders the loading skeleton while data is loading", () => {
    renderWithClient(<PoolPerformanceChart isLoading />);
    expect(screen.getByTestId("pool-chart-skeleton")).toBeInTheDocument();
  });

  it("renders an empty state when there are no snapshots", () => {
    renderWithClient(<PoolPerformanceChart snapshots={[]} />);
    expect(screen.getByText(/no pool snapshots yet/i)).toBeInTheDocument();
  });

  it("renders an error state instead of the chart on failure", () => {
    renderWithClient(<PoolPerformanceChart error={new Error("boom")} />);
    expect(screen.getByText(/temporarily unavailable/i)).toBeInTheDocument();
  });

  it("renders utilization and yield series with an accessible summary", () => {
    renderWithClient(<PoolPerformanceChart snapshots={snapshots} />);

    expect(
      screen.getByRole("heading", { name: "Pool Performance" }),
    ).toBeInTheDocument();
    // Legend entries confirm both series are plotted.
    expect(screen.getByText("Utilization")).toBeInTheDocument();
    expect(screen.getByText("Yield distributed")).toBeInTheDocument();

    // bps -> % conversion (7500 bps = 75%) in the screen-reader summary.
    const summary = screen.getByText(/pool utilization is currently/i);
    expect(summary).toHaveTextContent("currently 75.0 percent");
    expect(summary).toHaveTextContent("from 50.0 percent");
    expect(summary).toHaveTextContent("5 USDC");

    // Chart region exposes the same summary to assistive tech.
    expect(screen.getByRole("img")).toHaveAttribute(
      "aria-label",
      expect.stringContaining("75.0 percent"),
    );
  });
});
