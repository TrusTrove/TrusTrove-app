import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { RegistryClient } from "@trusttrove/sdk";
import {
  useIsVerified,
  useProfile,
  useRegistryMutations,
  UseRegistryOptions,
} from "../src/useRegistry.js";

vi.mock("@trusttrove/sdk", () => {
  class MockRegistryClient {
    contractId: string;
    constructor(contractId: string) {
      this.contractId = contractId;
    }
    isVerified = vi.fn();
    getProfile = vi.fn();
    registerIssuer = vi.fn();
    registerBuyer = vi.fn();
    revoke = vi.fn();
  }
  return { RegistryClient: MockRegistryClient };
});

const ADDRESS = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const SIGNER = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const CONTRACT_ID = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";

function makeOptions(client?: Partial<RegistryClient>): UseRegistryOptions {
  return { client: (client ?? {}) as RegistryClient };
}

describe("useRegistry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useIsVerified", () => {
    it("returns verification state with loading/error/data", async () => {
      const client = new RegistryClient(CONTRACT_ID);
      vi.mocked(client.isVerified).mockResolvedValue(true);

      const { result } = renderHook(() =>
        useIsVerified(ADDRESS, SIGNER, makeOptions(client)),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBe(true);
      expect(result.current.error).toBeNull();
      expect(client.isVerified).toHaveBeenCalledWith(ADDRESS, SIGNER);
    });

    it("surfaces errors instead of data", async () => {
      const client = new RegistryClient(CONTRACT_ID);
      vi.mocked(client.isVerified).mockRejectedValue(
        new Error("simulation failed"),
      );

      const { result } = renderHook(() =>
        useIsVerified(ADDRESS, SIGNER, makeOptions(client)),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeNull();
      expect(result.current.error).toEqual(new Error("simulation failed"));
    });
  });

  describe("useProfile", () => {
    it("returns the profile with loading/error/data state", async () => {
      const profile = {
        address: ADDRESS,
        role: "issuer",
        verified: true,
        registeredAt: 1234,
      } as const;
      const client = new RegistryClient(CONTRACT_ID);
      vi.mocked(client.getProfile).mockResolvedValue(profile as any);

      const { result } = renderHook(() =>
        useProfile(ADDRESS, SIGNER, makeOptions(client)),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(profile);
      expect(result.current.error).toBeNull();
      expect(client.getProfile).toHaveBeenCalledWith(ADDRESS, SIGNER);
    });

    it("surfaces profile errors", async () => {
      const client = new RegistryClient(CONTRACT_ID);
      vi.mocked(client.getProfile).mockRejectedValue(
        new Error("profile not found"),
      );

      const { result } = renderHook(() =>
        useProfile(ADDRESS, SIGNER, makeOptions(client)),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeNull();
      expect(result.current.error).toEqual(new Error("profile not found"));
    });
  });

  describe("useRegistryMutations", () => {
    it("exposes registerIssuer with pending/error state", async () => {
      const client = new RegistryClient(CONTRACT_ID);
      vi.mocked(client.registerIssuer).mockResolvedValue("mock-hash");

      const { result } = renderHook(() =>
        useRegistryMutations(SIGNER, makeOptions(client)),
      );

      expect(result.current.registerIssuer.isPending).toBe(false);

      let promise: Promise<string> | undefined;
      act(() => {
        promise = result.current.registerIssuer.mutate(ADDRESS, {
          role: "issuer",
        });
      });
      await waitFor(() =>
        expect(result.current.registerIssuer.isPending).toBe(true),
      );

      await act(async () => {
        await promise;
      });

      expect(await promise).toBe("mock-hash");
      expect(client.registerIssuer).toHaveBeenCalledWith(
        ADDRESS,
        { role: "issuer" },
        SIGNER,
      );
      await waitFor(() =>
        expect(result.current.registerIssuer.isPending).toBe(false),
      );
      expect(result.current.registerIssuer.error).toBeNull();
    });

    it("exposes registerBuyer mutation", async () => {
      const client = new RegistryClient(CONTRACT_ID);
      vi.mocked(client.registerBuyer).mockResolvedValue("mock-hash");

      const { result } = renderHook(() =>
        useRegistryMutations(SIGNER, makeOptions(client)),
      );

      await act(async () => {
        await result.current.registerBuyer.mutate(ADDRESS, { role: "buyer" });
      });

      expect(client.registerBuyer).toHaveBeenCalledWith(
        ADDRESS,
        { role: "buyer" },
        SIGNER,
      );
    });

    it("exposes revoke mutation", async () => {
      const client = new RegistryClient(CONTRACT_ID);
      vi.mocked(client.revoke).mockResolvedValue("mock-hash");

      const { result } = renderHook(() =>
        useRegistryMutations(SIGNER, makeOptions(client)),
      );

      await act(async () => {
        await result.current.revoke.mutate(ADDRESS);
      });

      expect(client.revoke).toHaveBeenCalledWith(ADDRESS, SIGNER);
    });

    it("records and rethrows mutation errors", async () => {
      const client = new RegistryClient(CONTRACT_ID);
      vi.mocked(client.revoke).mockRejectedValue(new Error("not admin"));

      const { result } = renderHook(() =>
        useRegistryMutations(SIGNER, makeOptions(client)),
      );

      let errorValue: unknown;
      await act(async () => {
        try {
          await result.current.revoke.mutate(ADDRESS);
        } catch (err) {
          errorValue = err;
        }
      });

      expect(errorValue).toEqual(new Error("not admin"));
      await waitFor(() =>
        expect(result.current.revoke.error).toEqual(new Error("not admin")),
      );
    });
  });
});
