import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useTxHistory, extractOpAmount } from "./useTxHistory";
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

describe("extractOpAmount", () => {
  const USER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

  it("returns amount and token for payment ops with asset_code (USDC)", () => {
    const op = {
      type: "payment",
      type_i: 1,
      amount: "100.0000000",
      asset_type: "credit4",
      asset_code: "USDC",
      asset_issuer: "GA4ZIZ7S7Q6Q7Q3O3K3Q3O3K3Q3O3K3Q3O3K3Q3O3K3Q3O3K3Q3O3",
      from: USER,
      to: "GC5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVM",
    };
    const result = extractOpAmount(op, USER);
    expect(result).toEqual({ amount: "100.0000000", token: "USDC" });
  });

  it("returns amount and XLM for native payment ops", () => {
    const op = {
      type: "payment",
      type_i: 1,
      amount: "50.0000000",
      asset_type: "native",
      from: USER,
      to: "GC5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVM",
    };
    const result = extractOpAmount(op, USER);
    expect(result).toEqual({ amount: "50.0000000", token: "XLM" });
  });

  it("returns amount and token for invoke_host_function with matching from in asset_balance_changes", () => {
    const op = {
      type: "invoke_host_function",
      type_i: 24,
      function: "fund_invoice",
      asset_balance_changes: [
        {
          asset_type: "credit4",
          asset_code: "USDC",
          from: USER,
          to: "GC5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVM",
          amount: "200.0000000",
        },
      ],
    };
    const result = extractOpAmount(op, USER);
    expect(result).toEqual({ amount: "200.0000000", token: "USDC" });
  });

  it("returns amount and XLM for invoke_host_function with native asset_balance_changes", () => {
    const op = {
      type: "invoke_host_function",
      type_i: 24,
      function: "withdraw",
      asset_balance_changes: [
        {
          asset_type: "native",
          from: "GC5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVM",
          to: USER,
          amount: "500.0000000",
        },
      ],
    };
    const result = extractOpAmount(op, USER);
    expect(result).toEqual({ amount: "500.0000000", token: "XLM" });
  });

  it("returns undefined when user is not involved in any balance change", () => {
    const op = {
      type: "invoke_host_function",
      type_i: 24,
      function: "deposit",
      asset_balance_changes: [
        {
          asset_type: "credit4",
          asset_code: "USDC",
          from: "GCARDINALFUNDINVOLVED",
          to: "GOTHERUSER",
          amount: "200.0000000",
        },
      ],
    };
    const result = extractOpAmount(op, USER);
    expect(result).toBeUndefined();
  });

  it("returns undefined for invoke_host_function with no asset_balance_changes", () => {
    const op = {
      type: "invoke_host_function",
      type_i: 24,
      function: "is_verified",
      asset_balance_changes: [],
    };
    const result = extractOpAmount(op, USER);
    expect(result).toBeUndefined();
  });

  it("returns undefined for unknown operation types", () => {
    const op = {
      type: "create_account",
      type_i: 0,
      starting_balance: "1000",
    };
    const result = extractOpAmount(op, USER);
    expect(result).toBeUndefined();
  });

  it("returns undefined when amount or token is missing", () => {
    const op = {
      type: "payment",
      type_i: 1,
      amount: "",
      asset_type: "credit4",
      asset_code: "USDC",
      from: USER,
      to: "GC5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVM",
    };
    const result = extractOpAmount(op, USER);
    expect(result).toBeUndefined();
  });
});
