import { ASSET_INFO } from "./assets";
import type { LPPosition, PoolStats } from "@/types";

/**
 * Decimals of the asset the pool accounts in (USDC). LP shares use the same
 * seven-decimal stroop scale, so both the redeemable amount and the pool's
 * available liquidity are rendered with it.
 */
export const POOL_ASSET_DECIMALS = ASSET_INFO.USDC.decimals;

const POOL_ASSET_DIVISOR = 10n ** BigInt(POOL_ASSET_DECIMALS);

/**
 * Formats a stroop-denominated pool amount using the pool asset's decimals
 * (not a hardcoded 10^7), e.g. `1_000_000_000n` -> `"100.00 USDC"`.
 *
 * @param amount - The amount in the pool asset's smallest unit. `undefined`
 *   renders a zeroed value instead of failing while data loads.
 */
export function formatPoolAmount(amount: bigint | undefined): string {
  const whole = Number(amount ?? 0n) / Number(POOL_ASSET_DIVISOR);
  return `${whole.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${ASSET_INFO.USDC.code}`;
}

/**
 * Converts a decimal share input into stroops, rounding down like the rest of
 * the app. Returns `null` when the input is not a finite positive number, so
 * callers can distinguish "nothing entered" from "invalid".
 */
export function sharesInputToStroops(input: string): bigint | null {
  if (input.trim() === "") return null;
  const shares = Number(input);
  if (!Number.isFinite(shares) || shares <= 0) return null;
  return BigInt(Math.floor(shares * Number(POOL_ASSET_DIVISOR)));
}

/** What a withdrawal would redeem and whether the pool can currently pay it. */
export interface WithdrawalAssessment {
  /** The shares being redeemed, in stroops. */
  shares: bigint;
  /** The asset value those shares would redeem, in the pool asset's units. */
  redeemable: bigint;
  /** Liquidity currently available to LPs, in the pool asset's units. */
  availableLiquidity: bigint;
  /** Current pool utilization in basis points (10000 = 100%). */
  utilizationRateBps: number;
  /**
   * `true` when `redeemable` exceeds `availableLiquidity`, i.e. the pool cannot
   * pay this withdrawal right now because the capital is deployed.
   */
  insufficientLiquidity: boolean;
  /** The part of `redeemable` the pool cannot currently cover. */
  shortfall: bigint;
}

/**
 * Prices a share withdrawal and compares it with the pool's available
 * liquidity before the user signs.
 *
 * The position's `usdcValue` already reflects the current share price, so the
 * redeemable value of a partial withdrawal is proportional to the requested
 * shares. All arithmetic stays in `bigint` stroops to avoid precision loss.
 *
 * @param params.shares - Shares to redeem, in stroops.
 * @param params.position - The connected wallet's LP position, if loaded.
 * @param params.stats - Pool statistics, if loaded.
 * @returns A {@link WithdrawalAssessment}; zeroed when the position or shares
 *   are missing.
 *
 * @example
 * ```ts
 * assessWithdrawal({ shares: 50_000_000n, position, stats });
 * ```
 */
export function assessWithdrawal({
  shares,
  position,
  stats,
}: {
  shares: bigint | null;
  position?: Pick<LPPosition, "shares" | "usdcValue"> | null;
  stats?: Pick<PoolStats, "availableLiquidity" | "utilizationRateBps"> | null;
}): WithdrawalAssessment {
  const positionShares = position?.shares ?? 0n;
  const requested = shares ?? 0n;
  const availableLiquidity = stats?.availableLiquidity ?? 0n;

  let redeemable = 0n;
  if (requested > 0n && positionShares > 0n) {
    const bounded = requested > positionShares ? positionShares : requested;
    redeemable = ((position?.usdcValue ?? 0n) * bounded) / positionShares;
  }

  const insufficientLiquidity = redeemable > availableLiquidity;

  return {
    shares: requested,
    redeemable,
    availableLiquidity,
    utilizationRateBps: stats?.utilizationRateBps ?? 0,
    insufficientLiquidity,
    shortfall: insufficientLiquidity ? redeemable - availableLiquidity : 0n,
  };
}

/**
 * Human-readable utilization for the pool, from basis points.
 *
 * @param utilizationRateBps - Utilization in basis points (10000 = 100%).
 * @returns A percentage string such as `"85.0%"`.
 */
export function formatUtilization(utilizationRateBps: number): string {
  const clamped = Math.min(100, Math.max(0, utilizationRateBps / 100));
  return `${clamped.toFixed(1)}%`;
}
