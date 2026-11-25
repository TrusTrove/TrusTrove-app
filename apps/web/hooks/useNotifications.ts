"use client";

import { useState, useMemo, useCallback } from "react";
import { useRecentEvents } from "./useEvents";

export type NotificationCategory = "all" | "invoice" | "pool" | "account";

export interface NotificationEvent {
  id: number | string;
  event_type: string;
  invoiceId?: string;
  contract_id?: string;
  ledger?: number;
  ledger_closed_at?: number;
  occurred_at?: string;
  data: Record<string, unknown>;
  read?: boolean;
}

export type StoredNotifications = Record<string, boolean>;

export const STORAGE_KEY = "trusttrove_notifications_read";

export function isNotificationEvent(value: unknown): value is NotificationEvent {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "string" && typeof v.event_type === "string";
  }

export function readStoredNotifications(storageKey: string): StoredNotifications {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as StoredNotifications;
  }
  } catch {
    // ignore read errors
  }
  return {};
}

import { useWalletStore } from "@/store/wallet";

export function useNotifications() {
const address = useWalletStore((s) => s.address);
  // The polling feeds below are scoped to the wallet, so they follow the same
  // `connected` flag the UI gates on rather than a rehydrated address alone
  // (issue #636).
  const connected = useWalletStore((s) => s.connected);
  const role = useWalletStore((s) => s.role);
  const { events, isLoading, error, refetch } = useRecentEvents(50);
  const [category, setCategory] = useState<NotificationCategory>("all");

  const [readMap, setReadMap] = useState<StoredNotifications>(() => readStoredNotifications(STORAGE_KEY));

  const persistReadMap = useCallback((nextMap: StoredNotifications) => {
    setReadMap(nextMap);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextMap));
      } catch {
        // ignore write errors
      }
      }
  }, []);

  const notifications = useMemo(() => {
    return events.filter(isNotificationEvent).map((evt) => ({
      ...evt,
      read: !!readMap[evt.id],
    }));
  }, [events, readMap]);

  const filteredNotifications = useMemo(() => {
    if (category === "all") return notifications;
    return notifications.filter((n) => {
      const type = n.event_type.toLowerCase();
      if (category === "invoice") return type.startsWith("invoice.");
      if (category === "pool") return type.startsWith("pool.");
      if (category === "account") return type.startsWith("account.") || type.includes("profile") || type.includes("wallet");
      return true;
    });
  }, [notifications, category]);

  const counts = useMemo(() => {
    const allCount = notifications.length;
    const unreadCount = notifications.filter((n) => !n.read).length;
    const invoiceCount = notifications.filter((n) => n.event_type.toLowerCase().startsWith("invoice.")).length;
    const poolCount = notifications.filter((n) => n.event_type.toLowerCase().startsWith("pool.")).length;
    const accountCount = notifications.filter((n) => {
      const t = n.event_type.toLowerCase();
      return t.startsWith("account.") || t.includes("profile") || t.includes("wallet");
    }).length;

    const filteredCount = category === "all"
      ? allCount
      : category === "invoice"
      ? invoiceCount
      : category === "pool"
      ? poolCount
      : accountCount;

    return {
      all: allCount,
      unread: unreadCount,
      invoice: invoiceCount,
      pool: poolCount,
      account: accountCount,
      filtered: filteredCount,
    };
  }, [notifications, category]);

  const markAsRead = useCallback(
    (id: string) => {
      const next = { ...readMap, [id]: true };
      persistReadMap(next);
    },
    [readMap, persistReadMap]
  );

  const markAllAsRead = useCallback(() => {
    const next = { ...readMap };
    for (const n of notifications) {
      next[n.id] = true;
    }
    persistReadMap(next);
  }, [notifications, readMap, persistReadMap]);

  return {
    notifications: filteredNotifications,
    allNotifications: notifications,
    isLoading,
    error,
    category,
    setCategory,
    counts,
    markAsRead,
    markAllAsRead,
    refetch,
  };
}
