import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPoolStats, getLPPosition } from '@/lib/api';
import { PoolClient } from '@trusttrove/sdk';
import { useWalletStore } from '@/store/wallet';
import { showSuccessToast, showErrorToast } from '@/lib/toast';

const poolContractID = process.env.NEXT_PUBLIC_POOL_CONTRACT_ID || '';

/**
 * Custom hook for interacting with the TrusTrove liquidity pool contract.
 *
 * Provides pool statistics, the connected wallet's LP position, and mutations
 * for depositing and withdrawing liquidity. All on-chain mutations require a
 * connected wallet.
 *
 * @returns An object containing:
 *   - `stats` — Global pool statistics (TVL, yield, utilisation), or `undefined` while loading.
 *   - `isStatsLoading` — `true` while pool stats are being fetched.
 *   - `statsError` — Fetch error for pool stats, or `null` if none.
 *   - `refetchStats` — Function to manually re-trigger the pool stats query.
 *   - `position` — The connected wallet's LP position (shares, claimable yield), or `undefined`.
 *   - `isPositionLoading` — `true` while the LP position is being fetched.
 *   - `positionError` — Fetch error for the LP position, or `null` if none.
 *   - `refetchPosition` — Function to manually re-trigger the LP position query.
 *   - `deposit` — Async mutation: deposit USDC into the pool and receive LP shares.
 *   - `isDepositing` / `depositError` — State for the deposit mutation.
 *   - `withdraw` — Async mutation: redeem LP shares for USDC from the pool.
 *   - `isWithdrawing` / `withdrawError` — State for the withdraw mutation.
 *
 * @throws On-chain mutations throw `Error('Wallet not connected')` when `address` is absent.
 *   The LP position query is disabled (skipped) when no wallet is connected.
 *
 * @example
 * const { stats, position, deposit, isDepositing, withdraw } = usePool();
 */
export function usePool() {
  const queryClient = useQueryClient();
  const { address } = useWalletStore();

  const statsQuery = useQuery({
    queryKey: ['poolStats'],
    queryFn: () => getPoolStats(),
  });

  const positionQuery = useQuery({
    queryKey: ['lpPosition', address],
    queryFn: () => getLPPosition(address!),
    enabled: !!address,
  });

  /**
   * Deposits USDC into the pool on behalf of the connected wallet.
   *
   * @param amount - Amount of USDC to deposit, expressed as a `bigint` in the token's
   *   smallest unit (stroops for Stellar).
   * @throws `Error('Wallet not connected')` if no wallet address is available.
   */
  const depositMutation = useMutation({
    mutationFn: async ({ amount }: { amount: bigint }) => {
      if (!address) throw new Error('Wallet not connected');
      const poolClient = new PoolClient(poolContractID);
      return poolClient.deposit(address, amount, address);
    },
    onSuccess: (txHash: string) => {
      queryClient.invalidateQueries({ queryKey: ['poolStats'] });
      queryClient.invalidateQueries({ queryKey: ['lpPosition', address] });
      showSuccessToast('Deposit Complete', txHash);
    },
    onError: (error) => {
      showErrorToast('Deposit Failed', error instanceof Error ? error : undefined);
    },
  });

  /**
   * Withdraws USDC from the pool by redeeming LP shares.
   *
   * @param shares - Number of LP shares to redeem, expressed as a `bigint`.
   * @throws `Error('Wallet not connected')` if no wallet address is available.
   */
  const withdrawMutation = useMutation({
    mutationFn: async ({ shares }: { shares: bigint }) => {
      if (!address) throw new Error('Wallet not connected');
      const poolClient = new PoolClient(poolContractID);
      return poolClient.withdraw(address, shares, address);
    },
    onSuccess: (txHash: string) => {
      queryClient.invalidateQueries({ queryKey: ['poolStats'] });
      queryClient.invalidateQueries({ queryKey: ['lpPosition', address] });
      showSuccessToast('Withdrawal Complete', txHash);
    },
    onError: (error) => {
      showErrorToast('Withdrawal Failed', error instanceof Error ? error : undefined);
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
  };
}
