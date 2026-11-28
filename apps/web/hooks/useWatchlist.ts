"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "./useWallet";

const WATCHLIST_STORAGE_PREFIX = "trusttrove:watchlist:";

export function useWatchlist() {
  const { address, connected } = useWallet();
  const [watchlist, setWatchlist] = useState<string[]>([]);

  const storageKey =
    connected && address ? `${WATCHLIST_STORAGE_PREFIX}${address}` : null;

  useEffect(() => {
    if (!storageKey) {
      setWatchlist([]);
      return;
    }
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setWatchlist(parsed);
        }
      } else {
        setWatchlist([]);
      }
    } catch {
      setWatchlist([]);
    }
  }, [storageKey]);

  const saveWatchlist = useCallback(
    (items: string[]) => {
      if (!storageKey) return;
      try {
        localStorage.setItem(storageKey, JSON.stringify(items));
        setWatchlist(items);
      } catch {
        // ignore quota or storage errors
      }
    },
    [storageKey],
  );

  const addBookmark = useCallback(
    (invoiceId: string) => {
      if (!storageKey) return;
      if (!watchlist.includes(invoiceId)) {
        saveWatchlist([...watchlist, invoiceId]);
      }
    },
    [storageKey, watchlist, saveWatchlist],
  );

  const removeBookmark = useCallback(
    (invoiceId: string) => {
      if (!storageKey) return;
      saveWatchlist(watchlist.filter((id) => id !== invoiceId));
    },
    [storageKey, watchlist, saveWatchlist],
  );

  const isBookmarked = useCallback(
    (invoiceId: string) => {
      return watchlist.includes(invoiceId);
    },
    [watchlist],
  );

  const checkInvoiceStatus = useCallback(
    (invoice: { status?: string; exists?: boolean } | null | undefined) => {
      if (
        !invoice ||
        invoice.exists === false ||
        invoice.status === "DELISTED" ||
        invoice.status === "EXPIRED" ||
        invoice.status === "STALE"
      ) {
        return "stale";
      }
      return "active";
    },
    [],
  );

  return {
    watchlist,
    addBookmark,
    removeBookmark,
    isBookmarked,
    checkInvoiceStatus,
  };
}
