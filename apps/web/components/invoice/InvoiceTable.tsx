"use client";

import React, { ReactNode } from "react";
import { Invoice } from "@/types";
import { InvoiceStatus } from "./InvoiceStatus";
import { formatAmount } from "@/lib/assets";

interface InvoiceTableProps {
  invoices: Invoice[];
  onSelectInvoice?: (invoice: Invoice) => void;
  activeId?: string | null;
  emptyState?: ReactNode;
}

export function InvoiceTable({
  invoices,
  onSelectInvoice,
  activeId,
  emptyState,
}: InvoiceTableProps) {
  const truncateAddr = (addr: string) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (invoices.length === 0 && emptyState) {
    return (
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {emptyState}
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-[#080c10]/40 text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest">
              <th className="px-5 py-3.5">Invoice ID</th>
              <th className="px-5 py-3.5">Buyer</th>
              <th className="px-5 py-3.5">Face Value</th>
              <th className="px-5 py-3.5">Discount</th>
              <th className="px-5 py-3.5">Due Date</th>
              <th className="px-5 py-3.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30 text-xs font-mono text-slate-300">
            {invoices.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-8 text-center text-slate-600 font-bold uppercase tracking-wider"
                >
                  No invoices found.
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => {
                const isActive = activeId === invoice.id;
                return (
                  <tr
                    key={invoice.id}
                    onClick={() => onSelectInvoice?.(invoice)}
                    className={`transition-colors ${
                      onSelectInvoice ? "cursor-pointer" : ""
                    } ${
                      isActive
                        ? "bg-primary/5 text-primary"
                        : "hover:bg-slate-900/50"
                    }`}
                  >
                    <td className="px-5 py-3.5 text-primary font-bold">
                      {truncateAddr(invoice.id)}
                    </td>
                    <td className="px-5 py-3.5 text-slate-400">
                      {truncateAddr(invoice.buyer)}
                    </td>
                    <td className="px-5 py-3.5 text-white font-bold">
                      {formatAmount(invoice.faceValue, invoice.asset)}
                    </td>
                    <td className="px-5 py-3.5 text-slate-300">
                      {invoice.discountBps > 0
                        ? `${(invoice.discountBps / 100).toFixed(2)}%`
                        : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-slate-400">
                      {new Date(invoice.dueDate * 1000).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <InvoiceStatus status={invoice.status} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
