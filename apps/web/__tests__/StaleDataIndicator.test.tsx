import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { StaleDataIndicator } from "../components/shared/StaleDataIndicator";

describe("StaleDataIndicator", () => {
  it("renders synced state correctly with ledger and time", () => {
    const onRefresh = vi.fn();
    render(
      <StaleDataIndicator
        lastIndexedLedger={100}
        lastIndexedAt={1600000000}
        isStale={false}
        onRefresh={onRefresh}
      />,
    );

    expect(screen.getByTestId("stale-data-indicator")).toHaveTextContent(
      "Synced",
    );
    expect(screen.getByTestId("stale-data-indicator")).toHaveTextContent(
      "Ledger: 100",
    );
  });

  it("renders stale state correctly and handles manual refresh boundary", () => {
    const onRefresh = vi.fn();
    render(
      <StaleDataIndicator
        lastIndexedLedger={99}
        isStale={true}
        onRefresh={onRefresh}
        isRefreshing={false}
      />,
    );

    expect(screen.getByTestId("stale-data-indicator")).toHaveTextContent(
      "Data may be stale.",
    );
    const refreshButton = screen.getByRole("button", {
      name: /Manual refresh indexed data/i,
    });
    fireEvent.click(refreshButton);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("handles empty and missing optional props gracefully", () => {
    const onRefresh = vi.fn();
    render(<StaleDataIndicator onRefresh={onRefresh} />);
    expect(screen.getByTestId("stale-data-indicator")).toBeInTheDocument();
  });
});
