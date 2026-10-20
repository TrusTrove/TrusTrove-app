"use client";

import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FilePlus2,
  Tag,
  Coins,
  Truck,
  PackageCheck,
  BadgeCheck,
  AlertTriangle,
  Activity,
  Zap,
} from "lucide-react";
import { useRecentEvents } from "@/hooks/useEvents";
import { InvoiceFeedSkeleton } from "@/components/shared/SkeletonLoader";
import { getEventDataString, type EventLog } from "@/types";

const FEED_LIMIT = 6;
const POLL_INTERVAL_MS = 10000;
const FEED_HEADING_ID = "invoice-feed-heading";

interface FeedEntry {
  id: number;
  label: string;
  details: string;
  time: string;
  Icon: typeof Activity;
}

const EVENT_LABELS: Record<string, string> = {
  InvoiceCreated: "Invoice Created",
  create: "Invoice Created",
  InvoiceListed: "Invoice Listed",
  list_for_financing: "Invoice Listed",
  InvoiceFunded: "Invoice Funded",
  fund_invoice: "Invoice Funded",
  InvoiceShipped: "Invoice Shipped",
  mark_shipped: "Invoice Shipped",
  DeliveryConfirmed: "Delivery Confirmed",
  confirm_delivery: "Delivery Confirmed",
  InvoiceRepaid: "Invoice Repaid",
  repay: "Invoice Repaid",
  InvoiceDefaulted: "Invoice Defaulted",
  trigger_default: "Invoice Defaulted",
};

const EVENT_ICONS: Record<string, typeof Activity> = {
  InvoiceCreated: FilePlus2,
  create: FilePlus2,
  InvoiceListed: Tag,
  list_for_financing: Tag,
  InvoiceFunded: Coins,
  fund_invoice: Coins,
  InvoiceShipped: Truck,
  mark_shipped: Truck,
  DeliveryConfirmed: PackageCheck,
  confirm_delivery: PackageCheck,
  InvoiceRepaid: BadgeCheck,
  repay: BadgeCheck,
  InvoiceDefaulted: AlertTriangle,
  trigger_default: AlertTriangle,
};

function formatRelativeTime(ledgerClosedAt: number): string {
  const diff = Math.floor(Date.now() / 1000) - ledgerClosedAt;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function toFeedEntry(event: EventLog): FeedEntry {
  const invoiceId = getEventDataString(event, "invoice_id") ?? "";
  const invoiceShort = invoiceId
    ? `INV#${invoiceId.slice(0, 6)}…`
    : "On-chain event";
  return {
    id: event.id,
    label: EVENT_LABELS[event.event_type] || event.event_type,
    details: invoiceShort,
    time: formatRelativeTime(event.ledger_closed_at),
    Icon: EVENT_ICONS[event.event_type] || Activity,
  };
}

export function InvoiceFeed() {
  const { events, isLoading } = useRecentEvents(FEED_LIMIT, {
    refetchInterval: POLL_INTERVAL_MS,
  });

  const items = useMemo(
    () => events.slice(0, FEED_LIMIT).map(toFeedEntry),
    [events],
  );

  return (
    <section
      aria-labelledby={FEED_HEADING_ID}
      className="border border-border/80 bg-[#0d131a] rounded-lg overflow-hidden h-[340px] flex flex-col"
    >
      <div className="bg-[#080c10] border-b border-border/40 px-4 py-3 flex items-center justify-between">
        <h2
          id={FEED_HEADING_ID}
          className="text-[10px] font-bold font-mono tracking-widest text-primary uppercase flex items-center gap-1.5"
        >
          <Zap className="w-3.5 h-3.5" aria-hidden="true" />
          Live Financing Feed
        </h2>
        <span className="text-[9px] font-mono text-slate-500 uppercase">
          Realtime testnet activity
        </span>
      </div>

      <div className="flex-1 p-4 relative overflow-hidden flex flex-col gap-3 justify-start">
        {isLoading ? (
          <InvoiceFeedSkeleton />
        ) : items.length === 0 ? (
          <div
            role="status"
            className="flex flex-col items-center justify-center h-full text-center gap-2"
          >
            <Activity className="w-5 h-5 text-slate-600" aria-hidden="true" />
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Awaiting on-chain activity
            </span>
          </div>
        ) : (
          <>
            <ul role="list" className="flex flex-col gap-3 list-none">
              <AnimatePresence initial={false}>
                {items.map((item) => {
                  const { Icon } = item;
                  return (
                    <motion.li
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: -40, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{
                        opacity: 0,
                        y: 40,
                        scale: 0.95,
                        position: "absolute",
                        bottom: 16,
                        left: 16,
                        right: 16,
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 350,
                        damping: 25,
                      }}
                      className="bg-[#080c10] border border-border/40 p-3 rounded flex items-center justify-between gap-4 w-full"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="text-primary shrink-0">
                          <Icon className="w-4 h-4" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-mono font-bold text-slate-300 block truncate">
                            {item.label}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 block">
                            {item.time}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[11px] font-mono font-bold text-primary block truncate max-w-[110px]">
                          {item.details}
                        </span>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
            {/* A live region on the list itself would re-announce on every 10s
                poll; this one only changes when the newest event does. */}
            <p role="status" className="sr-only">
              {`${items.length} recent events. Newest: ${items[0].label}, ${items[0].time}.`}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
