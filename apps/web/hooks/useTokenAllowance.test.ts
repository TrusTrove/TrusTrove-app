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
});
