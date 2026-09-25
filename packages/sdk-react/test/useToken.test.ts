import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { TokenClient } from "@trusttrove/sdk";
import { useAllowance, useApprove, UseTokenOptions } from "../src/useToken.js";

vi.mock("@trusttrove/sdk", () => {
  class MockTokenClient {
    contractId: string;
    constructor(contractId: string) {
      this.contractId = contractId;
    }
    static forUSDC = vi.fn();
    allowance = vi.fn();
    approve = vi.fn();
  }
  return { TokenClient: MockTokenClient };
});

const FROM = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const SPENDER = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";
const SIGNER = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const CONTRACT_ID = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";

function makeOptions(client?: Partial<TokenClient>): UseTokenOptions {
  return { client: (client ?? {}) as TokenClient };
}

describe("useToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useAllowance", () => {
    it("returns the allowance with loading/error/data state", async () => {
      const client = new TokenClient(CONTRACT_ID);
      vi.mocked(client.allowance).mockResolvedValue(1000n);

      const { result } = renderHook(() =>
        useAllowance(FROM, SPENDER, SIGNER, makeOptions(client)),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBe(1000n);
      expect(result.current.error).toBeNull();
      expect(client.allowance).toHaveBeenCalledWith(FROM, SPENDER, SIGNER);
    });

    it("surfaces read errors", async () => {
      const client = new TokenClient(CONTRACT_ID);
      vi.mocked(client.allowance).mockRejectedValue(new Error("read failed"));

      const { result } = renderHook(() =>
        useAllowance(FROM, SPENDER, SIGNER, makeOptions(client)),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeNull();
      expect(result.current.error).toEqual(new Error("read failed"));
    });

    it("refetches when the spender changes", async () => {
      const client = new TokenClient(CONTRACT_ID);
      vi.mocked(client.allowance).mockResolvedValue(500n);

      const { result, rerender } = renderHook(
        ({ spender }) =>
          useAllowance(FROM, spender, SIGNER, makeOptions(client)),
        { initialProps: { spender: SPENDER } },
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(client.allowance).toHaveBeenNthCalledWith(
        1,
        FROM,
        SPENDER,
        SIGNER,
      );

      rerender({ spender: SIGNER });
      await waitFor(() => expect(client.allowance).toHaveBeenCalledTimes(2));
      expect(client.allowance).toHaveBeenNthCalledWith(2, FROM, SIGNER, SIGNER);
    });
  });

  describe("useApprove", () => {
    it("exposes approve mutation with pending/error state", async () => {
      const client = new TokenClient(CONTRACT_ID);
      vi.mocked(client.approve).mockResolvedValue("mock-hash");

      const { result } = renderHook(() =>
        useApprove(SIGNER, makeOptions(client)),
      );

      expect(result.current.approve.isPending).toBe(false);

      let promise: Promise<string> | undefined;
      act(() => {
        promise = result.current.approve.mutate(FROM, SPENDER, 1000n, 100);
      });
      await waitFor(() => expect(result.current.approve.isPending).toBe(true));

      await act(async () => {
        await promise;
      });

      expect(await promise).toBe("mock-hash");
      expect(client.approve).toHaveBeenCalledWith(
        FROM,
        SPENDER,
        1000n,
        100,
        SIGNER,
      );
      await waitFor(() => expect(result.current.approve.isPending).toBe(false));
      expect(result.current.approve.error).toBeNull();
    });

    it("records and rethrows mutation errors", async () => {
      const client = new TokenClient(CONTRACT_ID);
      vi.mocked(client.approve).mockRejectedValue(new Error("user rejected"));

      const { result } = renderHook(() =>
        useApprove(SIGNER, makeOptions(client)),
      );

      let errorValue: unknown;
      await act(async () => {
        try {
          await result.current.approve.mutate(FROM, SPENDER, 1000n, 100);
        } catch (err) {
          errorValue = err;
        }
      });

      expect(errorValue).toEqual(new Error("user rejected"));
      await waitFor(() =>
        expect(result.current.approve.error).toEqual(
          new Error("user rejected"),
        ),
      );
    });
  });
});
