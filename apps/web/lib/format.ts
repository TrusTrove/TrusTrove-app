/**
 * Truncates a blockchain address for display, showing the first 6 and last 4 characters.
 *
 * @param addr - The full address string to truncate.
 * @returns The truncated address with ellipsis, or an empty string if the input is falsy.
 *
 * @example
 * ```ts
 * truncateAddress("GBBD47IF6LZ72Y..."); // "GBBD47...Y..."
 * ```
 */
export function truncateAddress(addr: string): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export interface PoolLiquidityStats {
  availableLiquidity: bigint;
  maxCapacity: bigint;
}

export type FundingCapacityStatus = "fundable" | "capacity-limited" | "unavailable";

/**
 * Determines the funding capacity status for an invoice given pool stats.
 *
 * @param requiredAmount - The amount required to fully fund the invoice.
 * @param poolStats - The current pool liquidity and capacity stats.
 * @returns The funding capacity status.
 */
export function getFundingCapacityStatus(
  requiredAmount: bigint,
  poolStats?: PoolLiquidityStats | null
): FundingCapacityStatus {
  if (!poolStats || poolStats.availableLiquidity < 0n || requiredAmount < 0n) {
    return "unavailable";
  }
  if (poolStats.availableLiquidity >= requiredAmount) {
    return "fundable";
  }
  if (poolStats.availableLiquidity > 0n) {
    return "capacity-limited";
  }
  return "unavailable";
}

