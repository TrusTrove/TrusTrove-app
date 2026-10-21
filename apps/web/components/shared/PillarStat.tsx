"use client";

import { usePool } from "@/hooks/usePool";
import { useStats } from "@/hooks/useStats";
import { StatValue } from "./StatValue";

export type PillarStatKind = "issuers" | "invoices" | "utilization";

/**
 * The one live value inside each "System architecture" pillar card (#996). The
 * card copy around it is static and stays on the server.
 */
export function PillarStat({ kind }: { kind: PillarStatKind }) {
  const { stats, isStatsLoading, statsError } = usePool();
  const {
    stats: protocolStats,
    isLoading: isProtocolStatsLoading,
    error: protocolStatsError,
  } = useStats();

  if (kind === "utilization") {
    return (
      <>
        {isStatsLoading ? (
          <span className="text-foreground font-bold animate-pulse">--.-%</span>
        ) : statsError ? (
          <span className="text-foreground font-bold">--.-%</span>
        ) : (
          <span className="text-foreground font-bold">
            {(stats?.utilizationRateBps || 0) / 100}% capacity
          </span>
        )}
      </>
    );
  }

  return (
    <StatValue
      value={
        kind === "issuers"
          ? protocolStats
            ? `${protocolStats.registered_issuers} registered`
            : null
          : protocolStats
            ? `${protocolStats.total_invoices.toLocaleString()} invoices`
            : null
      }
      isLoading={isProtocolStatsLoading}
      error={protocolStatsError}
    />
  );
}
