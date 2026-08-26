import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TxHistory } from "./TxHistory";
import { useTxHistory } from "@/hooks/useTxHistory";
import type { TxHistoryItem } from "@/types";

vi.mock("@/hooks/useTxHistory", () => ({
  useTxHistory: vi.fn(),
}));

vi.mock("@/components/shared/SkeletonLoader", () => ({
  SkeletonShimmer: () => <div data-testid="tx-row-skeleton" />,
}));

const mockTx: TxHistoryItem = {
  id: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3",
  type: "Pool Deposit",
  amount: "250.0000000",
  token: "USDC",
  timestamp: 1700000000,
  hash: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3",
  status: "success",
};

const EXPECTED_EXPLORER_URL = `https://stellar.expert/explorer/testnet/tx/${mockTx.hash}`;

function mockUseTxHistory(
  overrides: Partial<ReturnType<typeof useTxHistory>> = {},
) {
  vi.mocked(useTxHistory).mockReturnValue({
    transactions: [],
    isLoading: false,
    error: null,
    hasNext: false,
    hasPrev: false,
    goNext: vi.fn(),
    goPrev: vi.fn(),
    page: 1,
    refetch: vi.fn(),
    ...overrides,
  });
}

describe("TxHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("renders the empty state when there are no transactions", () => {
    mockUseTxHistory();

    render(<TxHistory address="GABC123" />);

    expect(screen.getByText("Transaction History")).toBeInTheDocument();
    expect(
      screen.getByText("No TrusTrove transactions found for this wallet."),
    ).toBeInTheDocument();
  });

  it("renders skeleton placeholders while loading", () => {
    mockUseTxHistory({ isLoading: true });

    render(<TxHistory address="GABC123" />);

    expect(screen.getAllByTestId("tx-row-skeleton").length).toBeGreaterThan(0);
    expect(
      screen.queryByText("No TrusTrove transactions found for this wallet."),
    ).not.toBeInTheDocument();
  });

  it("renders transaction rows with amount, truncated hash, and explorer link", () => {
    mockUseTxHistory({ transactions: [mockTx], hasNext: true });

    render(<TxHistory address="GABC123" />);

    expect(screen.getByText("Pool Deposit")).toBeInTheDocument();
    expect(screen.getByText("250.0000000 USDC")).toBeInTheDocument();

    const explorerLink = screen.getByRole("link", {
      name: "a1b2c3...b2c3",
    });
    expect(explorerLink).toHaveAttribute("href", EXPECTED_EXPLORER_URL);
    expect(explorerLink).toHaveAttribute("target", "_blank");

    const nextBtn = screen.getByRole("button", { name: /Next/i });
    const prevBtn = screen.getByRole("button", { name: /Previous/i });
    expect(nextBtn).toBeEnabled();
    expect(prevBtn).toBeDisabled();
  });

  it("disables pagination buttons when there is no previous or next page", () => {
    mockUseTxHistory({ transactions: [mockTx] });

    render(<TxHistory address="GABC123" />);

    expect(screen.getByRole("button", { name: /Next/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Previous/i })).toBeDisabled();
  });

  it("refetches when Try again is clicked in the error state", () => {
    const refetch = vi.fn();
    mockUseTxHistory({ error: new Error("Failed to fetch"), refetch });

    render(<TxHistory address="GABC123" />);

    expect(screen.getByText("Failed to load transactions")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Try again/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("copies the transaction hash when the copy button is clicked", async () => {
    mockUseTxHistory({ transactions: [mockTx] });

    render(<TxHistory address="GABC123" />);

    fireEvent.click(screen.getByTitle("Copy transaction hash"));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockTx.hash);
    expect(await screen.findByText("Copied!")).toBeInTheDocument();
  });

  it("navigates pages with the Previous and Next buttons", () => {
    const goNext = vi.fn();
    const goPrev = vi.fn();
    mockUseTxHistory({
      transactions: [mockTx],
      hasNext: true,
      hasPrev: true,
      page: 2,
      goNext,
      goPrev,
    });

    render(<TxHistory address="GABC123" />);

    expect(screen.getAllByText("Page 2")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: /Next/i }));
    expect(goNext).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /Previous/i }));
    expect(goPrev).toHaveBeenCalledTimes(1);
  });
});
