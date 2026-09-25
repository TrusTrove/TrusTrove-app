import { useEffect, useState } from "react";
import { useRecentEvents } from "./useEvents";
import { useInvoices } from "./useInvoices";
import { useWalletStore } from "@/store/wallet";
import {
  NotificationEvent,
  mapEventToNotification,
} from "@/types/notifications";

export function useNotifications() {
  const { address, role } = useWalletStore();
  const { events } = useRecentEvents(100, { refetchInterval: 15000 });
  const { invoices } = useInvoices({ limit: 500 });

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
      const invId = e.data?.invoice_id;
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
    const storageKey = `trusttrove_notifs_${address}`;
    let saved: NotificationEvent[] = [];

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) saved = JSON.parse(stored);
    } catch (err) {}

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
      const p = localStorage.getItem(`trusttrove_prefs_${address}`);
      if (p) prefs = JSON.parse(p);
    } catch (e) {}

    const allNotifs = Array.from(notifMap.values());
    const combined = allNotifs
      .filter((n) => prefs[n.type] !== false)
      .sort((a, b) => b.timestamp - a.timestamp);

    setNotifications(combined);

    try {
      localStorage.setItem(storageKey, JSON.stringify(allNotifs));
    } catch (err) {}
  }, [events, invoices, address, role]);

  const markAllAsRead = () => {
    if (!address) return;

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

    const storageKey = `trusttrove_notifs_${address}`;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const allSaved: NotificationEvent[] = JSON.parse(stored);
        const updated = allSaved.map((n) => ({ ...n, read: true }));
        localStorage.setItem(storageKey, JSON.stringify(updated));
      }
    } catch (err) {}
  };

  return {
    notifications,
    markAllAsRead,
  };
}
