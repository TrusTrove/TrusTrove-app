"use client";

import { usePool } from "@/hooks/usePool";
import { STROOP_DIVISOR } from "@/lib/assets";
import { StatValue } from "./StatValue";

// Compact USDC formatting (e.g. "12.4M") derived from the stroop-denominated stat.
function formatCompactUsdc(amount: bigint | undefined): string | null {
  if (amount === undefined) return null;
  const value = Number(amount) / STROOP_DIVISOR;
  return value.toLocaleString("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  });
}

/**
 * The hero's three live pool numbers. `#996` split this out of the page-wide
 * client bundle so the surrounding static copy can render on the server.
 */
export function HeroStats() {
  const { stats } = usePool();

  return (
    <div className="grid grid-cols-3 gap-4 border-t border-b border-border/40 py-6">
      {/* Pool Value */}
      <div className="text-center lg:text-left">
        <StatValue value={formatCompactUsdc(stats?.totalDeposits)} />
        <span className="text-[10px] font-mono text-muted-foreground uppercase font-bold tracking-wider block mt-1">
          USDC POOL VALUE
        </span>
      </div>

      {/* Invoices Funded */}
      <div className="text-center lg:text-left">
        <StatValue
          value={
            stats ? stats.activeInvoiceCount.toLocaleString("en-US") : null
          }
        />
        <span className="text-[10px] font-mono text-muted-foreground uppercase font-bold tracking-wider block mt-1">
          INVOICES FUNDED
        </span>
      </div>

      {/* Yield Distributed */}
      <div className="text-center lg:text-left">
        <StatValue value={formatCompactUsdc(stats?.totalYieldDistributed)} />
        <span className="text-[10px] font-mono text-muted-foreground uppercase font-bold tracking-wider block mt-1">
          YIELD DISTRIBUTED
        </span>
      </div>
    </div>
  );
}
