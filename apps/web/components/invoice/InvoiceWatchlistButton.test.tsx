import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { InvoiceWatchlistButton } from "./InvoiceWatchlistButton";
import { useWatchlist } from "@/hooks/useWatchlist";

vi.mock("@/hooks/useWatchlist", () => ({
  useWatchlist: vi.fn(),
}));

describe("InvoiceWatchlistButton", () => {
  const addBookmark = vi.fn();
  const removeBookmark = vi.fn();
  const isBookmarked = vi.fn();
  const checkInvoiceStatus = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useWatchlist).mockReturnValue({
      watchlist: [],
      addBookmark,
      removeBookmark,
      isBookmarked,
      checkInvoiceStatus,
    });
  });

  it("renders unbookmarked state and adds bookmark on click", () => {
    isBookmarked.mockReturnValue(false);
    checkInvoiceStatus.mockReturnValue("active");
    render(<InvoiceWatchlistButton invoiceId="inv-abc" />);

    const btn = screen.getByRole("button", { name: /Bookmark invoice/i });
    expect(btn).toBeInTheDocument();

    fireEvent.click(btn);
    expect(addBookmark).toHaveBeenCalledWith("inv-abc");
  });

  it("renders bookmarked state and removes bookmark on click", () => {
    isBookmarked.mockReturnValue(true);
    checkInvoiceStatus.mockReturnValue("active");
    render(<InvoiceWatchlistButton invoiceId="inv-abc" />);

    const btn = screen.getByRole("button", { name: /Remove invoice/i });
    expect(btn).toBeInTheDocument();

    fireEvent.click(btn);
    expect(removeBookmark).toHaveBeenCalledWith("inv-abc");
  });

  it("clearly marks stale or delisted invoices when bookmarked", () => {
    isBookmarked.mockReturnValue(true);
    checkInvoiceStatus.mockReturnValue("stale");
    render(
      <InvoiceWatchlistButton
        invoiceId="inv-abc"
        invoiceData={{ status: "DELISTED" }}
      />,
    );

    expect(screen.getByText(/Stale \/ Delisted/i)).toBeInTheDocument();
  });
});
