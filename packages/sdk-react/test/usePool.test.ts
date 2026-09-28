import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { PoolClient } from "@trusttrove/sdk";
import {
  usePoolStats,
  useLPPosition,
  usePoolMutations,
  UsePoolOptions,
} from "../src/usePool.js";

vi.mock("@trusttrove/sdk", () => {
  class MockPoolClient {
    contractId: string;
    constructor(contractId: string) {
      this.contractId = contractId;
    }
    getStats = vi.fn();
    getLPPosition = vi.fn();
    deposit = vi.fn();
    withdraw = vi.fn();
  }
  return { PoolClient: MockPoolClient };
});

const SIGNER = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const CONTRACT_ID = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";
const LP = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWHF";

function makeOptions(client?: Partial<PoolClient>): UsePoolOptions {
  return { client: (client ?? {}) as PoolClient };
}

describe("usePool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("usePoolStats", () => {
    it("returns pool stats with loading/error/data state", async () => {
      const stats = { totalDeposits: 1000n, activeInvoiceCount: 2 };
      const client = new PoolClient(CONTRACT_ID);
      vi.mocked(client.getStats).mockResolvedValue(stats as any);

      const { result } = renderHook(() =>
        usePoolStats(SIGNER, makeOptions(client)),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(stats);
      expect(result.current.error).toBeNull();
      expect(client.getStats).toHaveBeenCalledWith(SIGNER);
    });

    it("surfaces read errors", async () => {
      const client = new PoolClient(CONTRACT_ID);
      vi.mocked(client.getStats).mockRejectedValue(new Error("read failed"));

      const { result } = renderHook(() =>
        usePoolStats(SIGNER, makeOptions(client)),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeNull();
      expect(result.current.error).toEqual(new Error("read failed"));
    });
  });

  describe("useLPPosition", () => {
    it("returns the LP position with loading/error/data state", async () => {
      const position = { shares: 10n, depositCount: 1 };
      const client = new PoolClient(CONTRACT_ID);
      vi.mocked(client.getLPPosition).mockResolvedValue(position as any);

      const { result } = renderHook(() =>
        useLPPosition(LP, SIGNER, makeOptions(client)),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(position);
      expect(result.current.error).toBeNull();
      expect(client.getLPPosition).toHaveBeenCalledWith(LP, SIGNER);
    });

    it("surfaces read errors", async () => {
      const client = new PoolClient(CONTRACT_ID);
      vi.mocked(client.getLPPosition).mockRejectedValue(
        new Error("position failed"),
      );

      const { result } = renderHook(() =>
        useLPPosition(LP, SIGNER, makeOptions(client)),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeNull();
      expect(result.current.error).toEqual(new Error("position failed"));
    });

    it("refetches when the LP changes", async () => {
      const client = new PoolClient(CONTRACT_ID);
      vi.mocked(client.getLPPosition).mockResolvedValue({ shares: 1n } as any);

      const { result, rerender } = renderHook(
        ({ lp }) => useLPPosition(lp, SIGNER, makeOptions(client)),
        { initialProps: { lp: LP } },
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(client.getLPPosition).toHaveBeenNthCalledWith(1, LP, SIGNER);

      rerender({ lp: SIGNER });
      await waitFor(() =>
        expect(client.getLPPosition).toHaveBeenCalledTimes(2),
      );
      expect(client.getLPPosition).toHaveBeenNthCalledWith(2, SIGNER, SIGNER);
    });
  });

  describe("usePoolMutations", () => {
    it("exposes deposit mutation with pending/error state", async () => {
      const client = new PoolClient(CONTRACT_ID);
      vi.mocked(client.deposit).mockResolvedValue("mock-hash");

      const { result } = renderHook(() =>
        usePoolMutations(SIGNER, makeOptions(client)),
      );

      expect(result.current.deposit.isPending).toBe(false);

      let promise: Promise<string> | undefined;
      act(() => {
        promise = result.current.deposit.mutate(LP, 1000n);
      });
      await waitFor(() => expect(result.current.deposit.isPending).toBe(true));

      await act(async () => {
        await promise;
      });

      expect(await promise).toBe("mock-hash");
      expect(client.deposit).toHaveBeenCalledWith(LP, 1000n, SIGNER);
      await waitFor(() => expect(result.current.deposit.isPending).toBe(false));
      expect(result.current.deposit.error).toBeNull();
    });

    it("exposes withdraw mutation", async () => {
      const client = new PoolClient(CONTRACT_ID);
      vi.mocked(client.withdraw).mockResolvedValue("mock-hash");

      const { result } = renderHook(() =>
        usePoolMutations(SIGNER, makeOptions(client)),
      );

      await act(async () => {
        await result.current.withdraw.mutate(LP, 50n);
      });

      expect(client.withdraw).toHaveBeenCalledWith(LP, 50n, SIGNER);
    });

    it("records and rethrows mutation errors", async () => {
      const client = new PoolClient(CONTRACT_ID);
      vi.mocked(client.deposit).mockRejectedValue(
        new Error("insufficient allowance"),
      );

      const { result } = renderHook(() =>
        usePoolMutations(SIGNER, makeOptions(client)),
      );

      let errorValue: unknown;
      await act(async () => {
        try {
          await result.current.deposit.mutate(LP, 1000n);
        } catch (err) {
          errorValue = err;
        }
      });

      expect(errorValue).toEqual(new Error("insufficient allowance"));
      await waitFor(() =>
        expect(result.current.deposit.error).toEqual(
          new Error("insufficient allowance"),
        ),
      );
    });
  });
});
