import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useProfile } from "./useProfile";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RegistryClient } from "@trusttrove/sdk";
import { useWalletStore } from "@/store/wallet";

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(),
}));

vi.mock("@trusttrove/sdk", () => ({
  RegistryClient: vi.fn(function () {}),
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

/** Serve a cached profile for the `["profile"]` query, verified for the other. */
function mockRegisteredProfile(role: "issuer" | "buyer") {
  vi.mocked(useQuery).mockImplementation(((args: any) =>
    args.queryKey[0] === "profile"
      ? {
          data: {
            address: "G123",
            role,
            verified: true,
            registeredAt: 1000,
          },
          isLoading: false,
          error: null,
          refetch: vi.fn(),
        }
      : {
          data: true,
          isLoading: false,
          error: null,
          refetch: vi.fn(),
        }) as any);
}

describe("useProfile", () => {
  let mockInvalidateQueries: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    useWalletStore.getState().disconnect();

    mockInvalidateQueries = vi.fn();
    vi.mocked(useQueryClient).mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    } as any);

    vi.mocked(useQuery).mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    mockMutation();
  });

  it("returns null profile when not connected", () => {
    const { result } = renderHook(() => useProfile());
    expect(result.current.profile).toBeNull();
    expect(result.current.isProfileLoading).toBe(false);
  });

  it("returns profile when connected and exists", () => {
    const mockProfile = {
      address: "G123",
      role: "issuer" as const,
      verified: true,
      registeredAt: 1000,
    };

    vi.mocked(useQuery).mockImplementation(function (args: any): any {
      const qk = args.queryKey;
      if (qk[0] === "profile") {
        return {
          data: mockProfile,
          isLoading: false,
          error: null,
          refetch: vi.fn(),
        };
      }
      if (qk[0] === "isVerified") {
        return {
          data: true,
          isLoading: false,
          error: null,
          refetch: vi.fn(),
        };
      }
      return { data: null, isLoading: false, error: null, refetch: vi.fn() };
    });

    act(() => {
      useWalletStore.getState().connect("G123", "testnet");
    });

    const { result } = renderHook(() => useProfile());
    expect(result.current.profile).toEqual(mockProfile);
    expect(result.current.isVerified).toBe(true);
  });

  it("shows profile loading state", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    } as any);

    const { result } = renderHook(() => useProfile());
    expect(result.current.isProfileLoading).toBe(true);
  });

  it("shows profile error state", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Profile fetch failed"),
      refetch: vi.fn(),
    } as any);

    const { result } = renderHook(() => useProfile());
    expect(result.current.profileError).toEqual(
      new Error("Profile fetch failed"),
    );
  });

  it("profile queries are disabled without wallet", () => {
    renderHook(() => useProfile());
    const calls = vi.mocked(useQuery).mock.calls;
    for (const call of calls) {
      expect(call[0]?.enabled).toBe(false);
    }
  });

  it("register issuer mutation works", async () => {
    act(() => {
      useWalletStore.getState().connect("G123", "testnet");
    });

    const mockRegisterIssuer = vi.fn().mockResolvedValue("tx_hash");
    vi.mocked(RegistryClient).mockImplementation(function () {
      return { registerIssuer: mockRegisterIssuer };
    } as any);

    const { result } = renderHook(() => useProfile());

    await act(async () => {
      await result.current.register({
        role: "issuer",
        metadata: { name: "Test Issuer" },
      });
    });

    expect(mockRegisterIssuer).toHaveBeenCalledWith(
      "G123",
      { name: "Test Issuer" },
      "G123",
    );
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["profile", "G123"],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["isVerified", "G123"],
    });
  });

  it("register buyer mutation works", async () => {
    act(() => {
      useWalletStore.getState().connect("G123", "testnet");
    });

    const mockRegisterBuyer = vi.fn().mockResolvedValue("tx_hash");
    vi.mocked(RegistryClient).mockImplementation(function () {
      return { registerBuyer: mockRegisterBuyer };
    } as any);

    const { result } = renderHook(() => useProfile());

    await act(async () => {
      await result.current.register({
        role: "buyer",
        metadata: { company: "Test Buyer" },
      });
    });

    expect(mockRegisterBuyer).toHaveBeenCalledWith(
      "G123",
      { company: "Test Buyer" },
      "G123",
    );
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["profile", "G123"],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["isVerified", "G123"],
    });
  });

  it("refuses a second register call for an already registered buyer", async () => {
    act(() => {
      useWalletStore.getState().connect("G123", "testnet");
    });
    mockRegisteredProfile("buyer");

    const mockRegisterIssuer = vi.fn();
    const mockRegisterBuyer = vi.fn();
    vi.mocked(RegistryClient).mockImplementation(function () {
      return {
        registerIssuer: mockRegisterIssuer,
        registerBuyer: mockRegisterBuyer,
      };
    } as any);

    const { result } = renderHook(() => useProfile());

    // The old update path submitted role "issuer" for a buyer profile, which
    // the contract answers with AlreadyRegistered (issue #1109).
    await expect(
      act(async () => {
        await result.current.register({
          role: "issuer",
          metadata: { companyName: "Acme" },
        });
      }),
    ).rejects.toThrow(/already registered as buyer/);

    expect(mockRegisterIssuer).not.toHaveBeenCalled();
    expect(mockRegisterBuyer).not.toHaveBeenCalled();
    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });

  it("refuses a matching-role register for an existing profile", async () => {
    act(() => {
      useWalletStore.getState().connect("G123", "testnet");
    });
    mockRegisteredProfile("issuer");

    const mockRegisterIssuer = vi.fn();
    vi.mocked(RegistryClient).mockImplementation(function () {
      return { registerIssuer: mockRegisterIssuer };
    } as any);

    const { result } = renderHook(() => useProfile());

    await expect(
      act(async () => {
        await result.current.register({
          role: "issuer",
          metadata: { companyName: "Acme" },
        });
      }),
    ).rejects.toThrow(/already registered as issuer/);

    expect(mockRegisterIssuer).not.toHaveBeenCalled();
  });

  it("register mutation fails if no wallet", async () => {
    const { result } = renderHook(() => useProfile());

    await expect(
      act(async () => {
        await result.current.register({
          role: "issuer",
          metadata: {},
        });
      }),
    ).rejects.toThrow("Wallet not connected");
  });

  it("register mutation handles SDK failure", async () => {
    act(() => {
      useWalletStore.getState().connect("G123", "testnet");
    });

    vi.mocked(RegistryClient).mockImplementation(function () {
      return {
        registerIssuer: vi.fn().mockRejectedValue(new Error("On-chain error")),
      };
    } as any);

    const { result } = renderHook(() => useProfile());

    await expect(
      act(async () => {
        await result.current.register({
          role: "issuer",
          metadata: {},
        });
      }),
    ).rejects.toThrow("On-chain error");
  });

  it("lazily constructs and reuses one RegistryClient instance per mount", async () => {
    act(() => {
      useWalletStore.getState().connect("G123", "testnet");
    });

    vi.mocked(RegistryClient).mockImplementation(function () {
      return {
        getProfile: vi.fn().mockResolvedValue(null),
        isVerified: vi.fn().mockResolvedValue(false),
        registerIssuer: vi.fn().mockResolvedValue("tx_hash"),
        registerBuyer: vi.fn().mockResolvedValue("tx_hash"),
      };
    } as any);

    const { result, rerender, unmount } = renderHook(() => useProfile());

    // Mounting the hook (which the Navbar does on every route) must not import
    // or construct the SDK client (#995).
    expect(vi.mocked(RegistryClient)).not.toHaveBeenCalled();

    // Re-renders, refetches, and every mutation reuse the memoized client.
    rerender();
    await act(async () => {
      await result.current.register({
        role: "issuer",
        metadata: { name: "Test Issuer" },
      });
      await result.current.register({
        role: "issuer",
        metadata: { name: "Second Attempt" },
      });
      await result.current.refetchProfile();
    });

    expect(vi.mocked(RegistryClient)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(RegistryClient)).toHaveBeenCalledWith(
      process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID || "",
    );

    // A fresh mount stays lazy too; it only builds a new client when used.
    unmount();
    renderHook(() => useProfile());
    expect(vi.mocked(RegistryClient)).toHaveBeenCalledTimes(1);
  });

  it("refetchProfile refetches both queries", async () => {
    const refetch1 = vi.fn().mockResolvedValue(undefined);
    const refetch2 = vi.fn().mockResolvedValue(undefined);

    const mockImpl: any = (args: any) => {
      const qk = args.queryKey;
      if (qk[0] === "profile") {
        return { data: null, isLoading: false, error: null, refetch: refetch1 };
      }
      return { data: false, isLoading: false, error: null, refetch: refetch2 };
    };
    vi.mocked(useQuery).mockImplementation(mockImpl);

    const { result } = renderHook(() => useProfile());

    await act(async () => {
      await result.current.refetchProfile();
    });

    expect(refetch1).toHaveBeenCalled();
    expect(refetch2).toHaveBeenCalled();
  });
});
