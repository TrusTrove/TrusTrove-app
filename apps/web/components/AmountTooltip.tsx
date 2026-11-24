import React from "react";
import type { AssetType } from "@/types";
import { getAssetDetails, formatAmount } from "@/lib/assets";

interface AmountTooltipProps {
  amount: bigint | undefined;
  asset?: AssetType;
  className?: string;
}

/**
 * AmountTooltip component exposing asset code, issuer, network, and decimal precision.
 */
export function AmountTooltip({ amount, asset = "USDC", className }: AmountTooltipProps) {
  const info = getAssetDetails(asset);
  const formatted = formatAmount(amount, asset);
  const issuerText = info.issuer ? info.issuer : "Native (none)";
  const tooltipText = `Asset Code: ${info.code}\nIssuer: ${issuerText}\nNetwork: ${info.network}\nDecimals: ${info.decimals}`;

  return (
    <span title={tooltipText} className={className || "cursor-help underline decoration-dotted"}>
      {formatted}
    </span>
  );
}
