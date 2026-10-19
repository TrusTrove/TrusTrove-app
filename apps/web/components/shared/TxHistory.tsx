"use client";

import React, { useId, useState } from "react";
import {
  ExternalLink,
  CheckCircle,
  XCircle,
  Copy,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useTxHistory, isRateLimitError } from "@/hooks/useTxHistory";
import { SkeletonShimmer } from "./SkeletonLoader";

interface TxHistoryProps {
  address: string;
}

function TxRowSkeleton() {
  return (
    <div className="flex justify-between items-center bg-muted/40 border border-border rounded-xl p-4">
      <div className="flex items-center gap-3">
        <SkeletonShimmer className="w-5 h-5 rounded-full" />
        <div className="space-y-1.5">
          <SkeletonShimmer className="h-3.5 w-28" />
          <SkeletonShimmer className="h-3 w-20" />
        </div>
      </div>
      <div className="text-right space-y-1.5">
        <SkeletonShimmer className="h-3.5 w-16 ml-auto" />
        <SkeletonShimmer className="h-3 w-24 ml-auto" />
      </div>
    </div>
  );
}

export function TxHistory({ address }: TxHistoryProps) {
  const {
    transactions,
    isLoading,
    error,
    hasNext,
    hasPrev,
    goNext,
    goPrev,
    page,
    refetch,
  } = useTxHistory(address);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const headingId = useId();

  const handleCopy = async (hash: string) => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopiedHash(hash);
      setTimeout(() => setCopiedHash(null), 2000);
    } catch {
      // fallback
    }
  };

  const getStellarExpertUrl = (hash: string) => {
    return `https://stellar.expert/explorer/testnet/tx/${hash}`;
  };

  return (
    <section
      aria-labelledby={headingId}
      className="bg-card border border-border backdrop-blur-md rounded-2xl p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 id={headingId} className="text-lg font-bold text-foreground">
          Transaction History
        </h2>
        {page > 1 && (
          <span className="text-xs text-muted-foreground font-mono">
            Page {page}
          </span>
        )}
      </div>

      {error && (
        <div className="text-center py-6">
          <p className="text-destructive text-sm mb-2">
            {isRateLimitError(error)
              ? "Horizon is rate limiting this request. Please wait a moment."
              : "Failed to load transactions"}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="text-xs text-primary hover:text-primary/80 underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Try again
          </button>
        </div>
      )}

      {!error && isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <TxRowSkeleton key={i} />
          ))}
        </div>
      )}

      {!error && !isLoading && transactions.length === 0 && (
        <p className="text-muted-foreground text-sm text-center py-6">
          No TrusTrove transactions found for this wallet.
        </p>
      )}

      {!error && !isLoading && transactions.length > 0 && (
        <>
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex justify-between items-center bg-muted/30 border border-border rounded-xl p-4 transition-colors hover:bg-muted/60"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {tx.status === "success" ? (
                    <CheckCircle className="w-5 h-5 text-primary shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-destructive shrink-0" />
                  )}
                  <div className="min-w-0">
                    <span className="font-semibold text-foreground text-sm block truncate">
                      {tx.type}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(tx.timestamp * 1000).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  {tx.amount && (
                    <span className="text-sm font-bold text-foreground block">
                      {tx.amount} {tx.token || "USDC"}
                    </span>
                  )}
                  <div className="flex items-center gap-1.5 justify-end mt-1">
                    <button
                      type="button"
                      onClick={() => handleCopy(tx.hash)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      title="Copy transaction hash"
                      aria-label="Copy transaction hash"
                    >
                      {copiedHash === tx.hash ? (
                        <span className="text-primary text-[10px] font-mono">
                          Copied!
                        </span>
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                    <a
                      href={getStellarExpertUrl(tx.hash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-secondary hover:underline flex items-center gap-1 font-mono rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      {tx.hash.slice(0, 6)}...{tx.hash.slice(-4)}
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mt-5 pt-4 border-t border-border">
            <button
              type="button"
              onClick={goPrev}
              disabled={!hasPrev}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
              Previous
            </button>
            <span className="text-xs text-muted-foreground font-mono">
              Page {page}
            </span>
            <button
              type="button"
              onClick={goNext}
              disabled={!hasNext}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </>
      )}
    </section>
  );
}
