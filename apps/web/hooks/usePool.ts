import { useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPoolStats, getLPPosition } from "@/lib/api";
import type { PoolClient } from "@trusttrove/sdk";
import { useWalletStore } from "@/store/wallet";
import { showSuccessToast } from "@/lib/toast";
import { createErrorHandler } from "@/lib/errors";
import { useTokenAllowance } from "./useTokenAllowance";
import { useAppError } from "./useAppError";
import type { AssetType } from "@/types";

const { handleMutationError } = createErrorHandler("usePool");

const poolContractID = process.env.NEXT_PUBLIC_POOL_CONTRACT_ID || "";

interface DepositArguments {
  amount: bigint;
  asset: AssetType;
}

/**
 * Custom hook for interacting with the TrusTrove liquidity pool contract.
 *
 * Provides pool statistics, the connected wallet's LP position, and mutations
 * for depositing and withdrawing liquidity. All on-chain mutations require a
 * connected wallet.
 */
export function usePool() {
  const queryClient = useQueryClient();
  const address = useWalletStore((s) => s.address);
  const { ensureAllowance } = useTokenAllowance();
  const { error: appError, handleError, clearError } = useAppError();

  // Construction (and the SDK import itself) is deferred until a write runs:
  // the landing page and marketplace only read pool stats from the indexer,
  // so a visitor never needs the contract client (#995).
  const poolClientPromise = useRef<Promise<PoolClient> | null>(null);
  const getPoolClient = useCallback(() => {
    if (!poolClientPromise.current) {
      poolClientPromise.current = import("@trusttrove/sdk").then(
        ({ PoolClient }) => new PoolClient(poolContractID),
      );
    }
    return poolClientPromise.current;
  }, []);

  const statsQuery = useQuery({
    queryKey: ["poolStats"],
    queryFn: () => getPoolStats(),
    refetchInterval: 45000,
    staleTime: 45000,
  });

  const positionQuery = useQuery({
    queryKey: ["lpPosition", address],
    queryFn: () => getLPPosition(address!),
    enabled: !!address,
  });

  const depositMutation = useMutation({
    mutationFn: async ({ amount, asset }: DepositArguments) => {
      if (!address) {
        throw new Error("Wallet not connected");
      }

      // Issued assets require an allowance. Native XLM does not.
      if (asset === "USDC") {
        await ensureAllowance(poolContractID, amount);
      }

      const poolClient = await getPoolClient();
      return poolClient.deposit(address, amount, address);
    },
    onSuccess: (txHash: string) => {
      clearError();
      queryClient.invalidateQueries({ queryKey: ["poolStats"] });
      queryClient.invalidateQueries({ queryKey: ["lpPosition", address] });
      showSuccessToast("Deposit Complete", txHash);
    },
    onError: (error) => {
      handleMutationError(error, "Deposit Failed");
      handleError(error, "Deposit failed");
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async ({ shares }: { shares: bigint }) => {
      if (!address) {
        throw new Error("Wallet not connected");
      }
      const poolClient = await getPoolClient();
      return poolClient.withdraw(address, shares, address);
    },
    onSuccess: (txHash: string) => {
      clearError();
      queryClient.invalidateQueries({ queryKey: ["poolStats"] });
      queryClient.invalidateQueries({ queryKey: ["lpPosition", address] });
      showSuccessToast("Withdrawal Complete", txHash);
    },
    onError: (error) => {
      handleMutationError(error, "Withdrawal Failed");
      handleError(error, "Withdrawal failed");
    },
  });

  return {
    stats: statsQuery.data,
    isStatsLoading: statsQuery.isLoading,
    statsError: statsQuery.error,
    refetchStats: statsQuery.refetch,

    position: positionQuery.data,
    isPositionLoading: positionQuery.isLoading,
    positionError: positionQuery.error,
    refetchPosition: positionQuery.refetch,

    deposit: depositMutation.mutateAsync,
    isDepositing: depositMutation.isPending,
    depositError: depositMutation.error,

    withdraw: withdrawMutation.mutateAsync,
    isWithdrawing: withdrawMutation.isPending,
    withdrawError: withdrawMutation.error,

    appError,
  };
}
