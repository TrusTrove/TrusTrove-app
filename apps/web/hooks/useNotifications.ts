import { useEffect, useState } from "react";
import { useRecentEvents } from "./useEvents";
import { useInvoicesList } from "./useInvoices";
import { useWalletStore } from "@/store/wallet";
import {
  NotificationEvent,
  mapEventToNotification,
} from "@/types/notifications";
import { getEventDataString } from "@/types";
import { notificationHistoryKey } from "@/lib/storage";
import { prefsStorageKey } from "@/lib/notification-preferences";

interface StoredNotifications {
  /** Notification records recovered from storage. */
  items: NotificationEvent[];
  /** Whether the stored value was safe to parse and can therefore be rewritten. */
  canPersist: boolean;
  /** Whether a value exists under the storage key at all. */
  hasStored: boolean;
}

function isNotificationEvent(value: unknown): value is NotificationEvent {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === "string" && typeof candidate.type === "string";
}

/**
 * Reads one wallet's cached notification history without ever discarding the
 * raw value on failure.
 *
 * A `JSON.parse` failure used to be swallowed and the resulting empty list was
 * written straight back, permanently destroying the user's history and read
 * flags. Corrupt data is therefore reported as non-persistable: callers keep
 * rendering fresh events but leave the stored value untouched (issue #1093).
 */
function readStoredNotifications(storageKey: string): StoredNotifications {
  let raw: string | null;
  try {
    raw = localStorage.getItem(storageKey);
  } catch {
    return { items: [], canPersist: false, hasStored: false };
  }

  if (raw === null) {
    return { items: [], canPersist: true, hasStored: false };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { items: [], canPersist: false, hasStored: true };
  }

  if (!Array.isArray(parsed)) {
    return { items: [], canPersist: false, hasStored: true };
  }

  const items = parsed.filter(isNotificationEvent);
  return {
    items,
    // A partially malformed array is preserved on disk until it is repaired
    // or explicitly reset, rather than being replaced with the valid subset.
    canPersist: items.length === parsed.length,
    hasStored: true,
  };
}

export function useNotifications() {
  const address = useWalletStore((s) => s.address);
  const role = useWalletStore((s) => s.role);
  const { events } = useRecentEvents(100, {
    refetchInterval: 15000,
    enabled: !!address,
  });
  const { invoices } = useInvoicesList({ limit: 20, enabled: !!address });

  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);

  useEffect(() => {
    if (!address) {
      setNotifications([]);
      return;
    }

    const relevantInvoiceIds = new Set(
      invoices
        .filter(
          (inv) =>
            inv.issuer === address || inv.buyer === address || role === "lp",
        )
        .map((inv) => inv.id),
    );

    const relevantEvents = events.filter((e) => {
      const invId = getEventDataString(e, "invoice_id");
      if (!invId) return false;

      if (role === "lp" && relevantInvoiceIds.has(invId)) {
        return [
          "InvoiceListed",
          "list_for_financing",
          "InvoiceFunded",
          "fund_invoice",
          "InvoiceRepaid",
          "repay",
          "InvoiceDefaulted",
          "trigger_default",
        ].includes(e.event_type);
      }

      return relevantInvoiceIds.has(invId);
    });

    const mappedNotifs = relevantEvents.map(mapEventToNotification);
    const storageKey = notificationHistoryKey(address);
    const { items: saved, canPersist } = readStoredNotifications(storageKey);

    const notifMap = new Map<string, NotificationEvent>();
    saved.forEach((n) => notifMap.set(n.id, n));

    mappedNotifs.forEach((n) => {
      if (!notifMap.has(n.id)) {
        notifMap.set(n.id, n);
      } else {
        const existing = notifMap.get(n.id)!;
        notifMap.set(n.id, { ...n, read: existing.read });
      }
    });

    let prefs: Record<string, boolean> = {};
    try {
      const p = localStorage.getItem(prefsStorageKey(address));
      if (p) prefs = JSON.parse(p);
    } catch {}

    const allNotifs = Array.from(notifMap.values());
    const combined = allNotifs
      .filter((n) => prefs[n.type] !== false)
      .sort((a, b) => b.timestamp - a.timestamp);

    setNotifications(combined);

    // Leave corrupt history in place instead of overwriting it with whatever
    // could be recovered; otherwise the read flags are lost forever.
    if (canPersist) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(allNotifs));
      } catch {}
    }
  }, [events, invoices, address, role]);

  const markAllAsRead = () => {
    if (!address) return;

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

    const storageKey = notificationHistoryKey(address);
    const {
      items: allSaved,
      canPersist,
      hasStored,
    } = readStoredNotifications(storageKey);

    if (!hasStored || !canPersist) return;

    try {
      const updated = allSaved.map((n) => ({ ...n, read: true }));
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {}
  };

  return {
    notifications,
    markAllAsRead,
  };
}
