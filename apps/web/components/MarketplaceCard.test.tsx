import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MarketplaceCard } from "./MarketplaceCard";

describe("MarketplaceCard funding capacity indicator", () => {
  it("displays fundable status and allows funding with refresh callback", async () => {
    const mockOnFund = vi.fn().mockResolvedValue(undefined);
    const mockOnFunded = vi.fn();

    render(
      <MarketplaceCard
        id="inv-123"
        faceValue={1000n}
        fundedAmount={0n}
        poolStats={{ availableLiquidity: 2000n, maxCapacity: 5000n }}
        onFund={mockOnFund}
        onFunded={mockOnFunded}
      />
    );

    const badge = screen.getByTestId("capacity-status");
    expect(badge).toHaveTextContent("fundable");

    const fundButton = screen.getByRole("button", { name: /Fund Invoice/i });
    expect(fundButton).toBeEnabled();

    fireEvent.click(fundButton);
    await waitFor(() => expect(mockOnFund).toHaveBeenCalledWith("inv-123"));
    await waitFor(() => expect(mockOnFunded).toHaveBeenCalled());
  });

  it("displays capacity-limited status when liquidity is less than required", () => {
    render(
      <MarketplaceCard
        id="inv-456"
        faceValue={1000n}
        fundedAmount={0n}
        poolStats={{ availableLiquidity: 500n, maxCapacity: 5000n }}
      />
    );

    const badge = screen.getByTestId("capacity-status");
    expect(badge).toHaveTextContent("capacity-limited");

    const fundButton = screen.getByRole("button", { name: /Fund Partially / Limit/i });
    expect(fundButton).toBeEnabled();
  });

  it("displays unavailable status and disables funding when pool has zero liquidity", () => {
    render(
      <MarketplaceCard
        id="inv-789"
        faceValue={1000n}
        fundedAmount={0n}
        poolStats={{ availableLiquidity: 0n, maxCapacity: 5000n }}
      />
    );

    const badge = screen.getByTestId("capacity-status");
    expect(badge).toHaveTextContent("unavailable");

    const fundButton = screen.getByRole("button", { name: /Fund Invoice/i });
    expect(fundButton).toBeDisabled();
  });
});
