import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useTokenAllowance } from "./useTokenAllowance";
import { useWalletStore } from "@/store/wallet";
import { TokenClient, getSorobanServer } from "@trusttrove/sdk";

vi.mock("@trusttrove/sdk", () => ({
  TokenClient: {
    forUSDC: vi.fn(),
  },
  getSorobanServer: vi.fn(),
}));

describe("useTokenAllowance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWalletStore.getState().disconnect();
  });

  it("throws when wallet is not connected", async () => {
    const { result } = renderHook(() => useTokenAllowance());

    await expect(
      act(async () => {
        await result.current.ensureAllowance("CSPENDER", 100n);
      }),
    ).rejects.toThrow("Wallet not connected");
  });

  it("skips approve when allowance is already sufficient", async () => {
    useWalletStore.getState().connect("GTEST", "testnet");

    const mockAllowance = vi.fn().mockResolvedValue(200n);
    const mockApprove = vi.fn();
    vi.mocked(TokenClient.forUSDC).mockReturnValue({
      allowance: mockAllowance,
      approve: mockApprove,
    } as any);

    const { result } = renderHook(() => useTokenAllowance());

    await act(async () => {
      await result.current.ensureAllowance("CSPENDER", 100n);
    });

    expect(mockAllowance).toHaveBeenCalledWith("GTEST", "CSPENDER", "GTEST");
    expect(mockApprove).not.toHaveBeenCalled();
  });

  it("calls approve with the computed expiration ledger when allowance is insufficient", async () => {
    useWalletStore.getState().connect("GTEST", "testnet");

    const mockAllowance = vi.fn().mockResolvedValue(50n);
    const mockApprove = vi.fn().mockResolvedValue(undefined);
    const mockServer = {
      getLatestLedger: vi.fn().mockResolvedValue({ sequence: 1000 }),
    };
    vi.mocked(TokenClient.forUSDC).mockReturnValue({
      allowance: mockAllowance,
      approve: mockApprove,
    } as any);
    vi.mocked(getSorobanServer).mockReturnValue(mockServer as any);

    const { result } = renderHook(() => useTokenAllowance());

    await act(async () => {
      await result.current.ensureAllowance("CSPENDER", 100n);
    });

    expect(mockApprove).toHaveBeenCalledWith(
      "GTEST",
      "CSPENDER",
      100n,
      1000 + 535_680,
      "GTEST",
    );
  });

  it("propagates allowance and approval errors", async () => {
    useWalletStore.getState().connect("GTEST", "testnet");

    const mockAllowance = vi
      .fn()
      .mockRejectedValue(new Error("allowance failed"));
    const mockApprove = vi.fn().mockRejectedValue(new Error("approve failed"));
    vi.mocked(TokenClient.forUSDC).mockReturnValue({
      allowance: mockAllowance,
      approve: mockApprove,
    } as any);

    const { result } = renderHook(() => useTokenAllowance());

    await expect(
      act(async () => {
        await result.current.ensureAllowance("CSPENDER", 100n);
      }),
    ).rejects.toThrow("allowance failed");

    mockAllowance.mockResolvedValueOnce(25n);
    vi.mocked(getSorobanServer).mockReturnValue({
      getLatestLedger: vi.fn().mockResolvedValue({ sequence: 1000 }),
    } as any);

    await expect(
      act(async () => {
        await result.current.ensureAllowance("CSPENDER", 100n);
      }),
    ).rejects.toThrow("approve failed");
  });

  it("treats an allowance exactly equal to the amount as sufficient", async () => {
    useWalletStore.getState().connect("GTEST", "testnet");

    const mockAllowance = vi.fn().mockResolvedValue(100n);
    const mockApprove = vi.fn();
    const mockServer = { getLatestLedger: vi.fn() };
    vi.mocked(TokenClient.forUSDC).mockReturnValue({
      allowance: mockAllowance,
      approve: mockApprove,
    } as any);
    vi.mocked(getSorobanServer).mockReturnValue(mockServer as any);

    const { result } = renderHook(() => useTokenAllowance());

    await act(async () => {
      await result.current.ensureAllowance("CSPENDER", 100n);
    });

    expect(mockApprove).not.toHaveBeenCalled();
    // No ledger lookup either — the whole approval path is skipped.
    expect(mockServer.getLatestLedger).not.toHaveBeenCalled();
  });

  it("approves from a zero allowance", async () => {
    useWalletStore.getState().connect("GTEST", "testnet");

    const mockAllowance = vi.fn().mockResolvedValue(0n);
    const mockApprove = vi.fn().mockResolvedValue(undefined);
    vi.mocked(TokenClient.forUSDC).mockReturnValue({
      allowance: mockAllowance,
      approve: mockApprove,
    } as any);
    vi.mocked(getSorobanServer).mockReturnValue({
      getLatestLedger: vi.fn().mockResolvedValue({ sequence: 42 }),
    } as any);

    const { result } = renderHook(() => useTokenAllowance());

    await act(async () => {
      await result.current.ensureAllowance("CSPENDER", 1n);
    });

    expect(mockApprove).toHaveBeenCalledWith(
      "GTEST",
      "CSPENDER",
      1n,
      42 + 535_680,
      "GTEST",
    );
  });

  it("propagates a failure to read the latest ledger", async () => {
    useWalletStore.getState().connect("GTEST", "testnet");

    const mockApprove = vi.fn();
    vi.mocked(TokenClient.forUSDC).mockReturnValue({
      allowance: vi.fn().mockResolvedValue(0n),
      approve: mockApprove,
    } as any);
    vi.mocked(getSorobanServer).mockReturnValue({
      getLatestLedger: vi.fn().mockRejectedValue(new Error("rpc down")),
    } as any);

    const { result } = renderHook(() => useTokenAllowance());

    await expect(
      act(async () => {
        await result.current.ensureAllowance("CSPENDER", 100n);
      }),
    ).rejects.toThrow("rpc down");
    expect(mockApprove).not.toHaveBeenCalled();
  });

  it("keeps ensureAllowance stable across re-renders while the address is unchanged", () => {
    useWalletStore.getState().connect("GTEST", "testnet");

    const { result, rerender } = renderHook(() => useTokenAllowance());
    const first = result.current.ensureAllowance;

    rerender();

    expect(result.current.ensureAllowance).toBe(first);
  });
});
