"use client";

import React from "react";
import { RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";

export interface StaleDataIndicatorProps {
  lastIndexedLedger?: number;
  lastIndexedAt?: string | number | Date;
  isStale?: boolean;
  onRefresh: () => void;
  isRefreshing?: boolean;
  className?: string;
}

export function StaleDataIndicator({
  lastIndexedLedger,
  lastIndexedAt,
  isStale = false,
  onRefresh,
  isRefreshing = false,
  className = "",
}: StaleDataIndicatorProps) {
  const formattedTime = lastIndexedAt
    ? typeof lastIndexedAt === "number"
      ? new Date(lastIndexedAt * 1000).toLocaleTimeString()
      : typeof lastIndexedAt === "string"
        ? new Date(lastIndexedAt).toLocaleTimeString()
        : lastIndexedAt.toLocaleTimeString()
    : null;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs font-mono ${
        isStale
          ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
          : "border-slate-800 bg-card text-slate-400"
      } ${className}`}
      data-testid="stale-data-indicator"
    >
      <div className="flex items-center gap-2">
        {isStale ? (
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
        ) : (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-400" />
        )}
        <span>
          {isStale ? "Data may be stale." : "Synced."}
          {lastIndexedLedger !== undefined && ` Ledger: ${lastIndexedLedger}`}
          {formattedTime && ` (${formattedTime})`}
        </span>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
        className="inline-flex items-center gap-1.5 rounded bg-slate-800 px-2.5 py-1 font-sans text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700 disabled:opacity-50"
        aria-label="Manual refresh indexed data"
      >
        <RefreshCw
          className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`}
        />
        <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
      </button>
    </div>
  );
}
