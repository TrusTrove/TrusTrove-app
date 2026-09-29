import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { EscrowClient } from "@trusttrove/sdk";
import {
  useLockedAmount,
  useEscrowMutations,
  UseEscrowOptions,
} from "../src/useEscrow.js";

vi.mock("@trusttrove/sdk", () => {
  class MockEscrowClient {
    contractId: string;
    constructor(contractId: string) {
      this.contractId = contractId;
    }
    getLocked = vi.fn();
    lock = vi.fn();
    releaseToIssuer = vi.fn();
    releaseToPool = vi.fn();
    handleDefault = vi.fn();
  }
  return { EscrowClient: MockEscrowClient };
});

const INVOICE_HEX = "abcd";
const SIGNER = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const CONTRACT_ID = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";

function makeOptions(client?: Partial<EscrowClient>): UseEscrowOptions {
  return { client: (client ?? {}) as EscrowClient };
}

describe("useEscrow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useLockedAmount", () => {
    it("returns the locked amount with loading/error/data state", async () => {
      const client = new EscrowClient(CONTRACT_ID);
      vi.mocked(client.getLocked).mockResolvedValue(1000n);

      const { result } = renderHook(() =>
        useLockedAmount(INVOICE_HEX, SIGNER, makeOptions(client)),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBe(1000n);
      expect(result.current.error).toBeNull();
      expect(client.getLocked).toHaveBeenCalledWith(INVOICE_HEX, SIGNER);
    });

    it("surfaces read errors", async () => {
      const client = new EscrowClient(CONTRACT_ID);
      vi.mocked(client.getLocked).mockRejectedValue(new Error("read failed"));

      const { result } = renderHook(() =>
        useLockedAmount(INVOICE_HEX, SIGNER, makeOptions(client)),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeNull();
      expect(result.current.error).toEqual(new Error("read failed"));
    });

    it("refetches when the invoice changes", async () => {
      const client = new EscrowClient(CONTRACT_ID);
      vi.mocked(client.getLocked).mockResolvedValue(500n);

      const { result, rerender } = renderHook(
        ({ invoice }) => useLockedAmount(invoice, SIGNER, makeOptions(client)),
        { initialProps: { invoice: INVOICE_HEX } },
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(client.getLocked).toHaveBeenNthCalledWith(1, INVOICE_HEX, SIGNER);

      rerender({ invoice: "ef01" });
      await waitFor(() => expect(client.getLocked).toHaveBeenCalledTimes(2));
      expect(client.getLocked).toHaveBeenNthCalledWith(2, "ef01", SIGNER);
    });
  });

  describe("useEscrowMutations", () => {
    it("exposes lock mutation with pending/error state", async () => {
      const client = new EscrowClient(CONTRACT_ID);
      vi.mocked(client.lock).mockResolvedValue(true);

      const { result } = renderHook(() =>
        useEscrowMutations(SIGNER, makeOptions(client)),
      );

      expect(result.current.lock.isPending).toBe(false);

      let promise: Promise<boolean> | undefined;
      act(() => {
        promise = result.current.lock.mutate(INVOICE_HEX, 1000n);
      });
      await waitFor(() => expect(result.current.lock.isPending).toBe(true));

      await act(async () => {
        await promise;
      });

      expect(await promise).toBe(true);
      expect(client.lock).toHaveBeenCalledWith(INVOICE_HEX, 1000n, SIGNER);
      await waitFor(() => expect(result.current.lock.isPending).toBe(false));
      expect(result.current.lock.error).toBeNull();
    });

    it("exposes releaseToIssuer mutation", async () => {
      const client = new EscrowClient(CONTRACT_ID);
      vi.mocked(client.releaseToIssuer).mockResolvedValue(true);

      const { result } = renderHook(() =>
        useEscrowMutations(SIGNER, makeOptions(client)),
      );

      await act(async () => {
        await result.current.releaseToIssuer.mutate(INVOICE_HEX);
      });

      expect(client.releaseToIssuer).toHaveBeenCalledWith(INVOICE_HEX, SIGNER);
    });

    it("exposes releaseToPool mutation", async () => {
      const client = new EscrowClient(CONTRACT_ID);
      vi.mocked(client.releaseToPool).mockResolvedValue(true);

      const { result } = renderHook(() =>
        useEscrowMutations(SIGNER, makeOptions(client)),
      );

      await act(async () => {
        await result.current.releaseToPool.mutate(INVOICE_HEX, 250n);
      });

      expect(client.releaseToPool).toHaveBeenCalledWith(
        INVOICE_HEX,
        250n,
        SIGNER,
      );
    });

    it("exposes handleDefault mutation", async () => {
      const client = new EscrowClient(CONTRACT_ID);
      vi.mocked(client.handleDefault).mockResolvedValue(true);

      const { result } = renderHook(() =>
        useEscrowMutations(SIGNER, makeOptions(client)),
      );

      await act(async () => {
        await result.current.handleDefault.mutate(INVOICE_HEX);
      });

      expect(client.handleDefault).toHaveBeenCalledWith(INVOICE_HEX, SIGNER);
    });

    it("records and rethrows mutation errors", async () => {
      const client = new EscrowClient(CONTRACT_ID);
      vi.mocked(client.lock).mockRejectedValue(new Error("already locked"));

      const { result } = renderHook(() =>
        useEscrowMutations(SIGNER, makeOptions(client)),
      );

      let errorValue: unknown;
      await act(async () => {
        try {
          await result.current.lock.mutate(INVOICE_HEX, 1000n);
        } catch (err) {
          errorValue = err;
        }
      });

      expect(errorValue).toEqual(new Error("already locked"));
      await waitFor(() =>
        expect(result.current.lock.error).toEqual(new Error("already locked")),
      );
    });
  });
});
