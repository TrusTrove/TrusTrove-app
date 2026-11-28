"use client";

import React from "react";
import { Bookmark, AlertTriangle } from "lucide-react";
import { useWatchlist } from "@/hooks/useWatchlist";

interface InvoiceWatchlistButtonProps {
  invoiceId: string;
  invoiceData?: { status?: string; exists?: boolean };
}

export function InvoiceWatchlistButton({
  invoiceId,
  invoiceData,
}: InvoiceWatchlistButtonProps) {
  const { isBookmarked, addBookmark, removeBookmark, checkInvoiceStatus } =
    useWatchlist();
  const bookmarked = isBookmarked(invoiceId);
  const status = checkInvoiceStatus(invoiceData);
  const isStale = status === "stale";

  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (bookmarked) {
            removeBookmark(invoiceId);
          } else {
            addBookmark(invoiceId);
          }
        }}
        aria-label={
          bookmarked
            ? "Remove invoice from watchlist"
            : "Bookmark invoice in watchlist"
        }
        className={`inline-flex items-center justify-center p-2 rounded-md transition-colors border ${
          bookmarked
            ? "bg-teal-500/10 border-teal-500/30 text-teal-400 hover:bg-teal-500/20"
            : "bg-slate-800/40 border-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-800"
        }`}
        title={bookmarked ? "Bookmarked" : "Bookmark"}
      >
        <Bookmark className={`w-4 h-4 ${bookmarked ? "fill-current" : ""}`} />
      </button>
      {isStale && bookmarked && (
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded"
          title="This invoice is stale or delisted"
        >
          <AlertTriangle className="w-3 h-3" />
          Stale / Delisted
        </span>
      )}
    </div>
  );
}
