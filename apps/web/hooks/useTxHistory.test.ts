import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useTxHistory } from "./useTxHistory";
import { useQuery } from "@tanstack/react-query";

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
}));

vi.mock("@stellar/stellar-sdk", () => ({
  Horizon: {
    Server: vi.fn(function () {}),
  },
}));

describe("useTxHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty transactions when no data", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    const { result } = renderHook(() => useTxHistory("G123"));
    expect(result.current.transactions).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("returns transactions from query", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: {
        items: [
          {
            id: "tx1",
            type: "Create Invoice",
            timestamp: 1000,
            hash: "tx1",
            status: "success",
          },
          {
            id: "tx2",
            type: "Fund Invoice",
            timestamp: 2000,
            hash: "tx2",
            status: "success",
          },
        ],
        nextCursor: "cursor-2",
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    const { result } = renderHook(() => useTxHistory("G123"));
    expect(result.current.transactions).toHaveLength(2);
    expect(result.current.transactions[0].type).toBe("Create Invoice");
    expect(result.current.hasNext).toBe(true);
    expect(result.current.hasPrev).toBe(false);
    expect(result.current.page).toBe(1);
  });

  it("shows loading state", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    } as any);

    const { result } = renderHook(() => useTxHistory("G123"));
    expect(result.current.isLoading).toBe(true);
  });

  it("shows error state", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Horizon error"),
      refetch: vi.fn(),
    } as any);

    const { result } = renderHook(() => useTxHistory("G123"));
    expect(result.current.error).toEqual(new Error("Horizon error"));
  });

  it("hasNext is false when no nextCursor", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: { items: [], nextCursor: null },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    const { result } = renderHook(() => useTxHistory("G123"));
    expect(result.current.hasNext).toBe(false);
  });

  it("query is disabled without address", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    renderHook(() => useTxHistory(""));
    expect(vi.mocked(useQuery)).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    );
  });

  it("advances to next page when cursor available", () => {
    const refetch = vi.fn();
    vi.mocked(useQuery).mockReturnValue({
      data: {
        items: [
          {
            id: "tx1",
            type: "Test",
            timestamp: 1,
            hash: "tx1",
            status: "success",
          },
        ],
        nextCursor: "cursor-2",
      },
      isLoading: false,
      error: null,
      refetch,
    } as any);

    const { result } = renderHook(() => useTxHistory("G123"));

    act(() => {
      result.current.goNext();
    });

    expect(result.current.page).toBe(2);
    expect(result.current.hasPrev).toBe(true);
  });

  it("does not advance past last page", () => {
    const refetch = vi.fn();
    vi.mocked(useQuery).mockReturnValue({
      data: { items: [], nextCursor: null },
      isLoading: false,
      error: null,
      refetch,
    } as any);

    const { result } = renderHook(() => useTxHistory("G123"));

    act(() => {
      result.current.goNext();
    });

    expect(result.current.page).toBe(1);
  });

  it("goes back to previous page", () => {
    const refetch = vi.fn();
    vi.mocked(useQuery).mockReturnValue({
      data: {
        items: [
          {
            id: "tx2",
            type: "Test",
            timestamp: 2,
            hash: "tx2",
            status: "success",
          },
        ],
        nextCursor: "cursor-3",
      },
      isLoading: false,
      error: null,
      refetch,
    } as any);

    const { result } = renderHook(() => useTxHistory("G123"));

    act(() => result.current.goNext());
    expect(result.current.page).toBe(2);

    act(() => result.current.goPrev());
    expect(result.current.page).toBe(1);
    expect(result.current.hasPrev).toBe(false);
  });

  it("does not go back before first page", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: { items: [], nextCursor: null },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    const { result } = renderHook(() => useTxHistory("G123"));

    act(() => {
      result.current.goPrev();
    });

    expect(result.current.page).toBe(1);
  });
});
