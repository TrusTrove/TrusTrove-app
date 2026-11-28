"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { Invoice } from "@/types";
import { formatAmount } from "@/lib/assets";

export interface BuyerRepaymentCalendarProps {
  invoices?: Invoice[];
  timezone?: string;
  now?: number;
  locale?: string;
}

function dueDateKey(dueDate: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(dueDate * 1000));
}

function formatGroupLabel(key: string, locale: string): string {
  const [y, m, d] = key.split("-").map(Number);
  // `key` is already the calendar day in the requested timezone, so format it
  // as a UTC date. Re-applying the timezone would shift the label by a day for
  // timezones behind UTC.
  const date = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function BuyerRepaymentCalendar({
  invoices = [],
  timezone = "UTC",
  now = Math.floor(Date.now() / 1000),
  locale = "en-US",
}: BuyerRepaymentCalendarProps) {
  const groups = useMemo(() => {
    const map = new Map<string, Invoice[]>();
    for (const invoice of invoices) {
      const key = dueDateKey(invoice.dueDate, timezone);
      const list = map.get(key) ?? [];
      list.push(invoice);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => (a < b ? -1 : 1));
  }, [invoices, timezone]);

  if (invoices.length === 0) {
    return (
      <div
        className="rounded-lg border border-border bg-card p-6 text-center text-xs font-mono text-muted-foreground"
        role="region"
        aria-label="Buyer Repayment Calendar"
      >
        No upcoming repayments.
      </div>
    );
  }

  return (
    <section
      className="rounded-lg border border-border bg-card p-4 font-mono text-xs"
      role="region"
      aria-label="Buyer Repayment Calendar"
    >
      <header className="mb-4 border-b border-border/40 pb-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
          Repayment Calendar
        </h2>
        <p className="text-[10px] text-muted-foreground">
          Timezone: {timezone}
        </p>
      </header>

      <div className="space-y-4">
        {groups.map(([key, groupInvoices]) => {
          const overdue = groupInvoices.some((inv) => inv.dueDate < now);
          return (
            <div
              key={key}
              className={`rounded-md border p-3 ${
                overdue
                  ? "border-rose-500/40 bg-rose-500/5"
                  : "border-border/40 bg-background/40"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-bold text-foreground">
                  {formatGroupLabel(key, locale)}
                </h3>
                {overdue && (
                  <span className="text-[10px] font-bold uppercase text-rose-400">
                    Overdue
                  </span>
                )}
              </div>
              <ul className="space-y-2">
                {groupInvoices.map((invoice) => (
                  <li
                    key={invoice.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <Link
                      href={`/invoice/${invoice.id}`}
                      className="text-primary hover:underline font-bold"
                    >
                      {invoice.id.slice(0, 8)}…
                    </Link>
                    <span className="text-muted-foreground">
                      {formatAmount(invoice.faceValue, invoice.asset)}
                    </span>
                    <span
                      className={`text-[10px] uppercase font-bold ${
                        invoice.dueDate < now
                          ? "text-rose-400"
                          : "text-foreground"
                      }`}
                    >
                      {invoice.dueDate < now ? "Overdue" : "Due"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default BuyerRepaymentCalendar;
