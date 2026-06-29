import type { AssetType } from "@/types";

export const STROOP_DIVISOR = 10_000_000;

export interface AssetInfo {
  type: AssetType;
  code: string;
  label: string;
  isNative: boolean;
  issuer: string | null;
  decimals: number;
}

export const ASSET_INFO: Record<AssetType, AssetInfo> = {
  USDC: {
    type: "USDC",
    code: "USDC",
    label: "USDC",
    isNative: false,
    issuer:
      process.env.NEXT_PUBLIC_USDC_ISSUER ||
      "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
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

export function stroopsToNumber(amount: bigint): number {
  return Number(amount) / STROOP_DIVISOR;
}

export function numberToStroops(amount: number): bigint {
  return BigInt(Math.floor(amount * STROOP_DIVISOR));
}

export const ASSET_OPTIONS: { value: AssetType; label: string }[] = [
  { value: "USDC", label: "USDC" },
  { value: "XLM", label: "XLM" },
];
