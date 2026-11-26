import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useQuery } from "@tanstack/react-query";
import { getAllInvoices } from "@/lib/api";
import type { Invoice, InvoiceStatus } from "@/types";
import { useBuyerInvoices } from "./useBuyerInvoices";

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  getAllInvoices: vi.fn(),
}));

const BUYER = "GDSCOJVNZ4JUVWZ5O6VBTUGOH4ZE22QJ6WMOYWHB3FEDQ2APJ2RQEIHY";
const OTHER_BUYER = "GCV5ODH3SMUDETURTOQPQ7TD2YI4YS6DZMMXDFLSWLGBFZTCHYL6LDNW";

function makeInvoice(id: string, status: InvoiceStatus): Invoice {
  return {
    id,
    issuer: OTHER_BUYER,
    buyer: BUYER,
    faceValue: 1_000_000_000n,
    asset: "USDC",
    discountBps: 200,
    fundedAmount: 980_000_000n,
    dueDate: 1_900_000_000,
    status,
    createdAt: 1_800_000_000,
    fundedAt: 1_800_100_000,
    shippedAt: null,
    issuerConfirmed: false,
    buyerConfirmed: false,
    repaidAt: null,
  };
}

function mockQuery(overrides: Record<string, unknown> = {}) {
  vi.mocked(useQuery).mockReturnValue({
    data: undefined,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  } as any);
}

describe("useBuyerInvoices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("groups the connected buyer's invoices by next action", () => {
    mockQuery({
      data: [
        makeInvoice("shipped", "Active"),
        makeInvoice("repay", "Confirmed"),
        makeInvoice("closed", "Repaid"),
      ],
    });

    const { result } = renderHook(() => useBuyerInvoices(BUYER));

    expect(result.current.groups.map((group) => group.key)).toEqual([
      "repay",
      "confirm-delivery",
      "closed",
    ]);
    expect(result.current.actionableCount).toBe(2);
    expect(result.current.invoices).toHaveLength(3);
    expect(result.current.isLoading).toBe(false);
  });

  it("drops invoices addressed to another buyer", () => {
    mockQuery({
      data: [
        makeInvoice("mine", "Active"),
        { ...makeInvoice("theirs", "Active"), buyer: OTHER_BUYER },
      ],
    });

    const { result } = renderHook(() => useBuyerInvoices(BUYER));

    expect(result.current.invoices.map((invoice) => invoice.id)).toEqual([
      "mine",
    ]);
    expect(result.current.groups).toHaveLength(1);
  });

  it("keeps the query disabled without a valid buyer address", () => {
    mockQuery({ isLoading: true });

    const { result } = renderHook(() => useBuyerInvoices("not-an-address"));

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    );
    expect(result.current.isLoading).toBe(false);
    expect(result.current.groups).toEqual([]);
    expect(result.current.invoices).toEqual([]);
  });

  it("forwards the query error and refetch function", () => {
    const refetch = vi.fn();
    const error = new Error("network down");
    mockQuery({ error, refetch });

    const { result } = renderHook(() => useBuyerInvoices(BUYER));

    expect(result.current.error).toBe(error);
    result.current.refetch();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("fetches the full invoice set through the API", () => {
    mockQuery({ data: [] });

    renderHook(() => useBuyerInvoices(BUYER));

    const call = vi.mocked(useQuery).mock.calls[0][0] as unknown as {
      queryFn: () => Promise<unknown>;
    };
    void call.queryFn();
    expect(getAllInvoices).toHaveBeenCalledTimes(1);
  });
});
