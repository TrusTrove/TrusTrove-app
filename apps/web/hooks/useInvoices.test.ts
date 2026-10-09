import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  useInvoiceList,
  useInvoiceStats,
  useInvoiceActions,
  useInvoice,
  computeInvoiceStats,
  EMPTY_INVOICE_STATS,
} from "./useInvoices";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getInvoices,
  getAllInvoices,
  getInvoiceByID,
  createInvoice,
} from "@/lib/api";
import { InvoiceClient, PoolClient } from "@trusttrove/sdk";
import { useWalletStore } from "@/store/wallet";
import * as toast from "@/lib/toast";
import type { Invoice } from "@/types";

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  getInvoices: vi.fn(),
  getAllInvoices: vi.fn(),
  getInvoiceByID: vi.fn(),
  createInvoice: vi.fn(),
}));

vi.mock("@trusttrove/sdk", () => ({
  InvoiceClient: vi.fn(function () {}),
  PoolClient: vi.fn(function () {}),
}));

vi.mock("@/lib/toast", () => ({
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
}));

vi.mock("./useTokenAllowance", () => ({
  useTokenAllowance: () => ({
    ensureAllowance: vi.fn().mockResolvedValue(undefined),
  }),
}));

function mockMutation() {
  vi.mocked(useMutation).mockImplementation(
    (options: any) =>
      ({
        mutateAsync: async (args: any) => {
          try {
            const res = await options.mutationFn(args);
            options.onSuccess?.(res);
            return res;
          } catch (e) {
            options.onError?.(e);
            throw e;
          }
        },
        isPending: false,
        error: null,
      }) as any,
  );
}

describe("useInvoices", () => {
  let mockInvalidateQueries: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    useWalletStore.getState().disconnect();

    mockInvalidateQueries = vi.fn();
    vi.mocked(useQueryClient).mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    } as any);

    vi.mocked(useQuery).mockReturnValue({
      data: {
        data: [{ id: "1", faceValue: "100" }],
        total: 1,
        totalPages: 1,
        page: 1,
        limit: 20,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    mockMutation();
  });

  it("returns paginated invoices", () => {
    const { result } = renderHook(() => useInvoiceList());
    expect(result.current.invoices).toHaveLength(1);
    expect(result.current.total).toBe(1);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("returns empty array when no data", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    const { result } = renderHook(() => useInvoiceList());
    expect(result.current.invoices).toEqual([]);
    expect(result.current.total).toBe(0);
  });

  it("exposes loading state", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    } as any);

    const { result } = renderHook(() => useInvoiceList());
    expect(result.current.isLoading).toBe(true);
  });

  it("exposes error state", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Fetch failed"),
      refetch: vi.fn(),
    } as any);

    const { result } = renderHook(() => useInvoiceList());
    expect(result.current.error).toEqual(new Error("Fetch failed"));
  });

  it("createInvoice works and invalidates query", async () => {
    vi.mocked(createInvoice).mockResolvedValue({ invoice_id: "new_1" } as any);

    const { result } = renderHook(() => useInvoiceActions());

    await act(async () => {
      await result.current.createInvoice({
        buyer: "G123",
        faceValue: "100",
        dueDate: 1234567890,
      });
    });

    expect(createInvoice).toHaveBeenCalledWith(
      "G123",
      "100",
      1234567890,
      undefined,
    );
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["invoices"],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["invoiceStats"],
    });
    expect(toast.showSuccessToast).toHaveBeenCalled();
  });

  it("createInvoice handles failure", async () => {
    vi.mocked(createInvoice).mockRejectedValue(new Error("Creation failed"));

    const { result } = renderHook(() => useInvoiceActions());

    await expect(
      act(async () => {
        await result.current.createInvoice({
          buyer: "G123",
          faceValue: "100",
          dueDate: 1234567890,
        });
      }),
    ).rejects.toThrow("Creation failed");

    expect(toast.showErrorToast).toHaveBeenCalled();
  });

  it("listInvoice works and invalidates query", async () => {
    act(() => {
      useWalletStore.getState().connect("G123", "testnet");
    });

    const mockList = vi.fn().mockResolvedValue("ok");
    vi.mocked(InvoiceClient).mockImplementation(function () {
      return { listForFinancing: mockList };
    } as any);

    const { result } = renderHook(() => useInvoiceActions());

    await act(async () => {
      await result.current.listInvoice({ invoiceId: "inv1", discountBps: 200 });
    });

    expect(mockList).toHaveBeenCalledWith("inv1", 200, "G123");
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["invoices"],
    });
  });

  it("listInvoice fails if no wallet", async () => {
    const { result } = renderHook(() => useInvoiceActions());

    await expect(
      act(async () => {
        await result.current.listInvoice({
          invoiceId: "inv1",
          discountBps: 200,
        });
      }),
    ).rejects.toThrow("Wallet not connected");

    expect(toast.showErrorToast).toHaveBeenCalled();
  });

  it("fundInvoice works", async () => {
    act(() => {
      useWalletStore.getState().connect("G123", "testnet");
    });

    const mockFund = vi.fn().mockResolvedValue("ok");
    vi.mocked(PoolClient).mockImplementation(function () {
      return { fundInvoice: mockFund };
    } as any);

    const { result } = renderHook(() => useInvoiceActions());

    await act(async () => {
      await result.current.fundInvoice({ invoiceId: "inv1" });
    });

    expect(mockFund).toHaveBeenCalledWith("inv1", "G123");
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["invoices"],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["poolStats"],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["lpPosition", "G123"],
    });
  });

  it("fundInvoice fails if no wallet", async () => {
    const { result } = renderHook(() => useInvoiceActions());

    await expect(
      act(async () => {
        await result.current.fundInvoice({ invoiceId: "inv1" });
      }),
    ).rejects.toThrow("Wallet not connected");

    expect(toast.showErrorToast).toHaveBeenCalled();
  });

  it("shipInvoice handles failure", async () => {
    act(() => {
      useWalletStore.getState().connect("G123", "testnet");
    });

    vi.mocked(InvoiceClient).mockImplementation(function () {
      return {
        markShipped: vi.fn().mockRejectedValue(new Error("Ship failed")),
      };
    } as any);

    const { result } = renderHook(() => useInvoiceActions());

    await expect(
      act(async () => {
        await result.current.shipInvoice({ invoiceId: "inv1" });
      }),
    ).rejects.toThrow("Ship failed");

    expect(toast.showErrorToast).toHaveBeenCalled();
  });

  it("shipInvoice works", async () => {
    act(() => {
      useWalletStore.getState().connect("G123", "testnet");
    });

    const mockShip = vi.fn().mockResolvedValue("ok");
    vi.mocked(InvoiceClient).mockImplementation(function () {
      return { markShipped: mockShip };
    } as any);

    const { result } = renderHook(() => useInvoiceActions());

    await act(async () => {
      await result.current.shipInvoice({ invoiceId: "inv1" });
    });

    expect(mockShip).toHaveBeenCalledWith("inv1", "G123");
  });

  it("confirmDelivery handles failure", async () => {
    act(() => {
      useWalletStore.getState().connect("G123", "testnet");
    });

    vi.mocked(getInvoiceByID).mockResolvedValue({ buyer: "G_BUYER" } as any);
    vi.mocked(InvoiceClient).mockImplementation(function () {
      return {
        confirmDelivery: vi.fn().mockRejectedValue(new Error("Confirm failed")),
      };
    } as any);

    const { result } = renderHook(() => useInvoiceActions());

    await expect(
      act(async () => {
        await result.current.confirmDelivery({ invoiceId: "inv1" });
      }),
    ).rejects.toThrow("Confirm failed");

    expect(toast.showErrorToast).toHaveBeenCalled();
  });

  it("confirmDelivery works", async () => {
    act(() => {
      useWalletStore.getState().connect("G123", "testnet");
    });

    vi.mocked(getInvoiceByID).mockResolvedValue({ buyer: "G_BUYER" } as any);
    const mockConfirm = vi.fn().mockResolvedValue("ok");
    vi.mocked(InvoiceClient).mockImplementation(function () {
      return { confirmDelivery: mockConfirm };
    } as any);

    const { result } = renderHook(() => useInvoiceActions());

    await act(async () => {
      await result.current.confirmDelivery({ invoiceId: "inv1" });
    });

    expect(mockConfirm).toHaveBeenCalledWith("inv1", "G_BUYER", "G123");
  });

  it("repayInvoice works", async () => {
    act(() => {
      useWalletStore.getState().connect("G123", "testnet");
    });

    const mockGet = vi.fn().mockResolvedValue({ faceValue: 1000n });
    const mockRepay = vi.fn().mockResolvedValue("ok");
    vi.mocked(InvoiceClient).mockImplementation(function () {
      return { get: mockGet, repay: mockRepay };
    } as any);

    const { result } = renderHook(() => useInvoiceActions());

    await act(async () => {
      await result.current.repayInvoice({ invoiceId: "inv1" });
    });

    expect(mockGet).toHaveBeenCalledWith("inv1", "G123");
    expect(mockRepay).toHaveBeenCalledWith("inv1", "G123");
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["invoices"],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["poolStats"],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["lpPosition", "G123"],
    });
  });

  it("repayInvoice fails if no wallet", async () => {
    const { result } = renderHook(() => useInvoiceActions());

    await expect(
      act(async () => {
        await result.current.repayInvoice({ invoiceId: "inv1" });
      }),
    ).rejects.toThrow("Wallet not connected");

    expect(toast.showErrorToast).toHaveBeenCalled();
  });

  it("defaultInvoice works", async () => {
    act(() => {
      useWalletStore.getState().connect("G123", "testnet");
    });

    const mockDefault = vi.fn().mockResolvedValue("ok");
    vi.mocked(InvoiceClient).mockImplementation(function () {
      return { triggerDefault: mockDefault };
    } as any);

    const { result } = renderHook(() => useInvoiceActions());

    await act(async () => {
      await result.current.defaultInvoice({ invoiceId: "inv1" });
    });

    expect(mockDefault).toHaveBeenCalledWith("inv1", "G123");
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["invoices"],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["poolStats"],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["lpPosition", "G123"],
    });
  });

  it("defaultInvoice fails if no wallet", async () => {
    const { result } = renderHook(() => useInvoiceActions());

    await expect(
      act(async () => {
        await result.current.defaultInvoice({ invoiceId: "inv1" });
      }),
    ).rejects.toThrow("Wallet not connected");

    expect(toast.showErrorToast).toHaveBeenCalled();
  });

  it("defaultInvoice handles SDK failure", async () => {
    act(() => {
      useWalletStore.getState().connect("G123", "testnet");
    });

    vi.mocked(InvoiceClient).mockImplementation(function () {
      return {
        triggerDefault: vi.fn().mockRejectedValue(new Error("Default failed")),
      };
    } as any);

    const { result } = renderHook(() => useInvoiceActions());

    await expect(
      act(async () => {
        await result.current.defaultInvoice({ invoiceId: "inv1" });
      }),
    ).rejects.toThrow("Default failed");

    expect(toast.showErrorToast).toHaveBeenCalled();
  });
});

describe("useInvoice", () => {
  it("fetches a single invoice", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: { id: "inv1" },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    const { result } = renderHook(() => useInvoice("inv1"));
    expect(result.current.invoice).toEqual({ id: "inv1" });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("shows loading state", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    } as any);

    const { result } = renderHook(() => useInvoice("inv1"));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.invoice).toBeUndefined();
  });

  it("shows error state", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Not found"),
      refetch: vi.fn(),
    } as any);

    const { result } = renderHook(() => useInvoice("inv1"));
    expect(result.current.error).toEqual(new Error("Not found"));
  });

  it("is disabled when id is empty", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    renderHook(() => useInvoice(""));
    expect(vi.mocked(useQuery)).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    );
  });
});

/** Builds a minimal invoice for stats aggregation tests. */
function makeInvoice(
  id: string,
  status: Invoice["status"],
  fundedAmount = 0n,
): Invoice {
  return { id, status, fundedAmount } as unknown as Invoice;
}

// 250 invoices spread over what would be multiple table pages: 120 Listed,
// 50 Funded, 60 Repaid, and 110 funded with 1_000_000 stroops each.
const FULL_SET: Invoice[] = [
  ...Array.from({ length: 80 }, (_, i) => makeInvoice(`inv-${i}`, "Listed")),
  ...Array.from({ length: 20 }, (_, i) =>
    makeInvoice(`inv-${80 + i}`, "Created"),
  ),
  ...Array.from({ length: 50 }, (_, i) =>
    makeInvoice(`inv-${100 + i}`, "Funded", 1_000_000n),
  ),
  ...Array.from({ length: 60 }, (_, i) =>
    makeInvoice(`inv-${150 + i}`, "Repaid", 1_000_000n),
  ),
  ...Array.from({ length: 40 }, (_, i) =>
    makeInvoice(`inv-${210 + i}`, "Listed"),
  ),
];

describe("computeInvoiceStats", () => {
  it("aggregates an invoice set spanning more than one table page", () => {
    const stats = computeInvoiceStats(FULL_SET);

    expect(stats.totalInvoicesCreated).toBe(250);
    expect(stats.totalListed).toBe(120);
    expect(stats.totalFundedActive).toBe(50);
    expect(stats.totalRepaid).toBe(60);
    expect(stats.totalFunded).toBe(110_000_000n);
  });

  it("counts Active and Confirmed as funded & active", () => {
    const stats = computeInvoiceStats([
      makeInvoice("a", "Active"),
      makeInvoice("b", "Confirmed"),
      makeInvoice("c", "Funded"),
      makeInvoice("d", "Defaulted"),
    ]);

    expect(stats.totalFundedActive).toBe(3);
    expect(stats.totalInvoicesCreated).toBe(4);
    expect(stats.totalRepaid).toBe(0);
  });

  it("returns zeroed stats for an empty set", () => {
    expect(computeInvoiceStats([])).toEqual(EMPTY_INVOICE_STATS);
  });
});

describe("useInvoiceStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    } as any);
  });

  const lastQueryOptions = () =>
    vi.mocked(useQuery).mock.calls.at(-1)![0] as any;

  it("aggregates the full unpaged set via getAllInvoices, not a page slice", async () => {
    vi.mocked(getAllInvoices).mockResolvedValue(FULL_SET);

    renderHook(() => useInvoiceStats("GISSUER"));
    const options = lastQueryOptions();

    expect(options.enabled).toBe(true);
    const stats = await options.queryFn();
    expect(getAllInvoices).toHaveBeenCalledWith({ issuer: "GISSUER" });
    expect(stats).toEqual({
      totalInvoicesCreated: 250,
      totalListed: 120,
      totalFundedActive: 50,
      totalRepaid: 60,
      totalFunded: 110_000_000n,
    });
  });

  it("keys the stats query by issuer only, independent of table pagination", () => {
    const statsKey = () => {
      renderHook(() => useInvoiceStats("GISSUER"));
      return lastQueryOptions().queryKey;
    };

    const before = statsKey();
    // The user pages the table around — the list query key changes…
    renderHook(() => useInvoiceList({ issuer: "GISSUER", page: 1, limit: 20 }));
    const listKeyPage1 = lastQueryOptions().queryKey;
    renderHook(() => useInvoiceList({ issuer: "GISSUER", page: 3, limit: 50 }));
    const listKeyPage3 = lastQueryOptions().queryKey;
    expect(listKeyPage1).not.toEqual(listKeyPage3);

    // …but the stats query key must not (issue #874).
    const after = statsKey();
    expect(after).toEqual(before);
    expect(after).toEqual(["invoiceStats", "GISSUER"]);
  });

  it("is disabled until an issuer address is known", () => {
    renderHook(() => useInvoiceStats(undefined));
    expect(vi.mocked(useQuery)).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    );
  });

  it("returns zeroed stats while loading", () => {
    const { result } = renderHook(() => useInvoiceStats("GISSUER"));
    expect(result.current.stats).toEqual(EMPTY_INVOICE_STATS);
    expect(result.current.isLoading).toBe(true);
  });

  it("returns cached stats once loaded", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: {
        totalInvoicesCreated: 250,
        totalListed: 120,
        totalFundedActive: 50,
        totalRepaid: 60,
        totalFunded: 110_000_000n,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    const { result } = renderHook(() => useInvoiceStats("GISSUER"));
    expect(result.current.stats.totalInvoicesCreated).toBe(250);
    expect(result.current.stats.totalRepaid).toBe(60);
    expect(result.current.isLoading).toBe(false);
  });
});
