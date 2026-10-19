import type { AssetType } from "@/types";
import { USDC_ISSUER } from "./env";

/**
 * Number of stroops per whole unit on Stellar (10^7 = 1 unit).
 *
 * All on-chain amounts are u128 integers denominated in stroops; divide by
 * this constant to get a human-readable whole-unit amount.
 */
export const STROOP_DIVISOR = 10_000_000;

export interface AssetInfo {
  type: AssetType;
  code: string;
  label: string;
  isNative: boolean;
  issuer: string | null;
  decimals: number;
}

/**
 * Metadata describing each supported asset, keyed by asset type.
 *
 * `issuer` falls back to the `NEXT_PUBLIC_USDC_ISSUER` env var (or the
 * default testnet issuer) for USDC, and is `null` for the native XLM asset.
 */
export const ASSET_INFO: Record<AssetType, AssetInfo> = {
  USDC: {
    type: "USDC",
    code: "USDC",
    label: "USDC",
    isNative: false,
    issuer: USDC_ISSUER,
    decimals: 7,
  },
  XLM: {
    type: "XLM",
    code: "XLM",
    label: "XLM",
    isNative: true,
    issuer: null,
    decimals: 7,
  },
};

/**
 * Formats a stroop-denominated amount as a human-readable string with the
 * asset code appended, e.g. `"1,000.00 USDC"`.
 *
 * @param amount - The amount in stroops (10^7 = 1 unit), or `undefined` to
 *   render a zeroed value for the given asset.
 * @param asset - The asset code to append. Defaults to `"USDC"`.
 * @returns The formatted amount string, e.g. `"100.00 USDC"`.
 *
 * @example
 * ```ts
 * formatAmount(1_000_000_000n); // "100.00 USDC"
 * formatAmount(10_000_000_000n, "USDC"); // "1,000.00 USDC"
 * formatAmount(undefined, "XLM"); // "0.00 XLM"
 * ```
 */
export function formatAmount(
  amount: bigint | undefined,
  asset: AssetType = "USDC",
): string {
  if (amount === undefined) return `0.00 ${asset}`;
  const formatted = (Number(amount) / STROOP_DIVISOR).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formatted} ${asset}`;
}

/**
 * Converts a stroop-denominated amount to a plain JavaScript number.
 *
 * Note: use sparingly for display only — `Number` loses precision for very
 * large u128 values.
 *
 * @param amount - The amount in stroops (10^7 = 1 unit).
 * @returns The amount as a whole-unit number (e.g. `1_000_000_000n` → `100`).
 *
 * @example
 * ```ts
 * stroopsToNumber(1_000_000_000n); // 100
 * ```
 */
export function stroopsToNumber(amount: bigint): number {
  return Number(amount) / STROOP_DIVISOR;
}

/**
 * Converts a plain whole-unit number to a stroop-denominated bigint,
 * rounding down to the nearest stroop.
 *
 * @param amount - The amount in whole units (e.g. `100`).
 * @returns The amount in stroops as a bigint (e.g. `100` → `1_000_000_000n`).
 *
 * @example
 * ```ts
 * numberToStroops(100); // 1_000_000_000n
 * numberToStroops(0.5); // 5_000_000n
 * ```
 */
export function numberToStroops(amount: number): bigint {
  return BigInt(Math.floor(amount * STROOP_DIVISOR));
}

/** Denominator of a basis-point rate: 10,000 bps is 100%. */
const BPS_DENOMINATOR = 10_000n;

/**
 * Subtracts a basis-point discount from a face value, entirely in bigint
 * stroops.
 *
 * The fee is rounded **up** to the nearest stroop so the result matches
 * `Math.floor(faceValue - faceValue * bps / 10000)` for the magnitudes that
 * implementation was already exact at, while staying precise above `2^53`
 * stroops, where `Number(faceValue)` silently rounds the input and the
 * preview drifts by a stroop or two from what the contract settles.
 *
 * @param faceValue - The invoice face value in stroops.
 * @param discountBps - A whole number of basis points (e.g. `500` = 5%).
 * @returns The funded value in stroops.
 * @throws TypeError if `discountBps` is not a whole number.
 *
 * @example
 * ```ts
 * fundedValueStroops(1_000_000_000n, 500); // 950_000_000n
 * ```
 */
export function fundedValueStroops(
  faceValue: bigint,
  discountBps: number,
): bigint {
  if (!Number.isInteger(discountBps)) {
    throw new TypeError(
      `discountBps must be a whole number of basis points, got ${discountBps}`,
    );
  }
  const fee =
    (faceValue * BigInt(discountBps) + BPS_DENOMINATOR - 1n) / BPS_DENOMINATOR;
  return faceValue - fee;
}

/**
 * Selectable asset choices for forms and dropdowns (USDC, then XLM).
 */
export const ASSET_OPTIONS: { value: AssetType; label: string }[] = [
  { value: "USDC", label: "USDC" },
  { value: "XLM", label: "XLM" },
];
