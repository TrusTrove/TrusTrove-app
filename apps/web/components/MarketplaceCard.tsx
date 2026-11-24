import React from "react";
import { getFundingCapacityStatus, type PoolLiquidityStats } from "@/lib/format";

interface MarketplaceCardProps {
  id: string;
  faceValue: bigint;
  fundedAmount: bigint;
  poolStats?: PoolLiquidityStats | null;
  onFund?: (id: string) => Promise<void> | void;
  onFunded?: () => void;
}

/**
 * MarketplaceCard displays invoice values along with its funding capacity status based on pool liquidity.
 * Users can fund invoices if the pool capacity permits, and the component triggers a refresh of the indication after funding completes.
 */
export function MarketplaceCard({
  id,
  faceValue,
  fundedAmount,
  poolStats,
  onFund,
  onFunded,
}: MarketplaceCardProps) {
  const [isFunding, setIsFunding] = React.useState(false);
  const requiredAmount = faceValue - fundedAmount;
  const status = getFundingCapacityStatus(requiredAmount, poolStats);

  const statusStyles = {
    fundable: "bg-green-500/20 text-green-400 border-green-500/30",
    "capacity-limited": "bg-amber-500/20 text-amber-400 border-amber-500/30",
    unavailable: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  const statusLabels = {
    fundable: "Fundable",
    "capacity-limited": "Capacity Limited",
    unavailable: "Unavailable",
  };

  const handleFundClick = async () => {
    if (!onFund || isFunding) return;
    setIsFunding(true);
    try {
      await onFund(id);
      if (onFunded) {
        onFunded();
      }
    } finally {
      setIsFunding(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col justify-between space-y-4" data-testid="marketplace-card">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-muted-foreground">Invoice #{id.slice(0, 8)}</span>
        <span
          data-testid="capacity-badge"
          className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${statusStyles[status]}`}
        >
          {statusLabels[status]}
        </span>
      </div>

      <div className="space-y-1">
        <span className="text-[10px] text-muted-foreground font-mono uppercase block">Face Value</span>
        <span className="text-lg font-bold font-mono text-foreground">{faceValue.toString()} USDC</span>
      </div>

      {onFund && (
        <button
          type="button"
          disabled={status === "unavailable" || isFunding}
          onClick={handleFundClick}
          className="w-full py-2 px-4 rounded bg-primary text-primary-foreground text-xs font-mono font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
        >
          {isFunding ? "Funding..." : "Fund Invoice"}
        </button>
      )}
    </div>
  );
}
