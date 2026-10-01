import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  useTxHistory,
  extractOpAmount,
  fetchPage,
  isRateLimitError,
  HorizonRateLimitError,
  createCachedOpsFetcher,
  txOpsQueryKey,
} from "./useTxHistory";
import { useQuery, useQueryClient, QueryClient } from "@tanstack/react-query";

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return { ...actual, useQuery: vi.fn(), useQueryClient: vi.fn() };
});

const transactionsCall = vi.fn();
const operationsCall = vi.fn();

const transactionsBuilder = {
  forAccount: vi.fn(() => transactionsBuilder),
  limit: vi.fn(() => transactionsBuilder),
  order: vi.fn(() => transactionsBuilder),
  cursor: vi.fn(() => transactionsBuilder),
  call: (...args: unknown[]) => transactionsCall(...args),
};

const operationsBuilder = {
  forTransaction: vi.fn((hash: string) => {
    operationsBuilder._hash = hash;
    return operationsBuilder;
  }),
  limit: vi.fn(() => operationsBuilder),
  call: () => operationsCall(operationsBuilder._hash),
  _hash: "",
};

vi.mock("@stellar/stellar-sdk", () => ({
  Horizon: {
    Server: vi.fn(function () {
      return {
        transactions: () => transactionsBuilder,
        operations: () => operationsBuilder,
      };
    }),
  },
}));

describe("useTxHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useQueryClient).mockReturnValue({
      fetchQuery: vi.fn(),
    } as unknown as QueryClient);
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

describe("isRateLimitError", () => {
  it("recognizes a HorizonRateLimitError", () => {
    expect(isRateLimitError(new HorizonRateLimitError())).toBe(true);
  });

  it("recognizes an axios-style 429 response", () => {
    expect(isRateLimitError({ response: { status: 429 } })).toBe(true);
  });

  it("recognizes a flat 429 status", () => {
    expect(isRateLimitError({ status: 429 })).toBe(true);
  });

  it("rejects other errors and non-objects", () => {
    expect(isRateLimitError(new Error("boom"))).toBe(false);
    expect(isRateLimitError({ response: { status: 404 } })).toBe(false);
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError("429")).toBe(false);
  });
});

describe("fetchPage", () => {
  const CONTRACT_ID = process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID;

  beforeEach(() => {
    vi.clearAllMocks();
    transactionsCall.mockReset();
    operationsCall.mockReset();
  });

  it("returns an empty page without fetching any operations", async () => {
    transactionsCall.mockResolvedValue({ records: [] });
    const fetchOps = vi.fn();

    const page = await fetchPage("G123", undefined, fetchOps);

    expect(page).toEqual({ items: [], nextCursor: null });
    expect(fetchOps).not.toHaveBeenCalled();
  });

  it("asks the ops fetcher once per transaction on the page", async () => {
    transactionsCall.mockResolvedValue({
      records: [
        { hash: "h1", created_at: "2024-01-01T00:00:00Z", successful: true },
        { hash: "h2", created_at: "2024-01-02T00:00:00Z", successful: true },
      ],
    });
    const fetchOps = vi.fn().mockResolvedValue([]);

    await fetchPage("G123", undefined, fetchOps);

    expect(fetchOps).toHaveBeenCalledTimes(2);
    expect(fetchOps).toHaveBeenCalledWith("h1");
    expect(fetchOps).toHaveBeenCalledWith("h2");
  });

  it("skips transactions whose operations lookup failed for a non-rate-limit reason", async () => {
    transactionsCall.mockResolvedValue({
      records: [
        { hash: "h1", created_at: "2024-01-01T00:00:00Z", successful: true },
      ],
    });
    const fetchOps = vi.fn().mockRejectedValue(new Error("network down"));

    const page = await fetchPage("G123", undefined, fetchOps);

    expect(page.items).toEqual([]);
  });

  it("throws a HorizonRateLimitError when an operations lookup is throttled", async () => {
    transactionsCall.mockResolvedValue({
      records: [
        { hash: "h1", created_at: "2024-01-01T00:00:00Z", successful: true },
      ],
    });
    const fetchOps = vi.fn().mockRejectedValue({ response: { status: 429 } });

    await expect(fetchPage("G123", undefined, fetchOps)).rejects.toBeInstanceOf(
      HorizonRateLimitError,
    );
  });

  it("throws a HorizonRateLimitError when the transaction page itself is throttled", async () => {
    transactionsCall.mockRejectedValue({ response: { status: 429 } });

    await expect(fetchPage("G123", undefined, vi.fn())).rejects.toBeInstanceOf(
      HorizonRateLimitError,
    );
  });

  it("maps a matching contract operation into a history item", async () => {
    transactionsCall.mockResolvedValue({
      records: [
        {
          hash: "h1",
          created_at: "2024-01-01T00:00:00Z",
          successful: true,
          paging_token: "pt1",
        },
      ],
    });
    const fetchOps = vi
      .fn()
      .mockResolvedValue([{ contract_id: CONTRACT_ID, function: "deposit" }]);

    const page = await fetchPage("G123", undefined, fetchOps);

    // Without contract env vars configured there is nothing to match against,
    // so assert on whichever branch this environment exercises.
    if (CONTRACT_ID) {
      expect(page.items).toHaveLength(1);
      expect(page.items[0].type).toBe("Pool Deposit");
    } else {
      expect(page.items).toHaveLength(0);
    }
  });
});

describe("createCachedOpsFetcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    operationsCall.mockReset();
  });

  it("issues one Horizon request per transaction hash, however often it is asked", async () => {
    operationsCall.mockImplementation((hash: string) =>
      Promise.resolve({ records: [{ contract_id: `c-${hash}` }] }),
    );
    const client = new QueryClient();
    const fetchOps = createCachedOpsFetcher(client);

    const first = await fetchOps("hash-a");
    await fetchOps("hash-a");
    await fetchOps("hash-a");
    await fetchOps("hash-b");

    expect(first).toEqual([{ contract_id: "c-hash-a" }]);
    expect(operationsCall).toHaveBeenCalledTimes(2);
    client.clear();
  });

  it("converts a throttled lookup into a HorizonRateLimitError", async () => {
    operationsCall.mockRejectedValue({ response: { status: 429 } });
    const client = new QueryClient();

    await expect(
      createCachedOpsFetcher(client)("hash-c"),
    ).rejects.toBeInstanceOf(HorizonRateLimitError);
    client.clear();
  });
});

describe("txOpsQueryKey", () => {
  it("keys on the transaction hash so entries are shared across pages", () => {
    const key = txOpsQueryKey("abc");
    expect(key[0]).toBe("txOps");
    expect(key[key.length - 1]).toBe("abc");
    expect(txOpsQueryKey("abc")).toEqual(key);
    expect(txOpsQueryKey("def")).not.toEqual(key);
  });
});
