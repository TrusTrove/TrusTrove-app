import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useWatchlist } from "./useWatchlist";
import { useWallet } from "./useWallet";

vi.mock("./useWallet", () => ({
  useWallet: vi.fn(),
}));

describe("useWatchlist", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("returns empty watchlist when wallet is not connected", () => {
    vi.mocked(useWallet).mockReturnValue({
      connected: false,
      address: null,
    } as any);
    const { result } = renderHook(() => useWatchlist());
    expect(result.current.watchlist).toEqual([]);
  });

  it("allows adding and removing bookmarks when wallet is connected", () => {
    vi.mocked(useWallet).mockReturnValue({
      connected: true,
      address: "G12345",
    } as any);

    const { result } = renderHook(() => useWatchlist());

    act(() => {
      result.current.addBookmark("inv-1");
    });
    act(() => {
      result.current.addBookmark("inv-2");
    });

    expect(result.current.watchlist).toEqual(["inv-1", "inv-2"]);
    expect(result.current.isBookmarked("inv-1")).toBe(true);

    act(() => {
      result.current.removeBookmark("inv-1");
    });

    expect(result.current.watchlist).toEqual(["inv-2"]);
    expect(result.current.isBookmarked("inv-1")).toBe(false);
  });

  it("correctly flags stale or delisted invoices", () => {
    vi.mocked(useWallet).mockReturnValue({
      connected: true,
      address: "G12345",
    } as any);

    const { result } = renderHook(() => useWatchlist());

    expect(result.current.checkInvoiceStatus(null)).toBe("stale");
    expect(result.current.checkInvoiceStatus({ exists: false })).toBe("stale");
    expect(result.current.checkInvoiceStatus({ status: "DELISTED" })).toBe(
      "stale",
    );
    expect(result.current.checkInvoiceStatus({ status: "ACTIVE" })).toBe(
      "active",
    );
  });
});
