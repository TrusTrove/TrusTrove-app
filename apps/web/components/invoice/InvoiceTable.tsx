"use client";

import React, { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useVirtualizer } from "@tanstack/react-virtual";
import { formatAmount } from "@/lib/assets";
import { Invoice } from "@/types";
import { Button } from "@/components/ui/button";
import { InvoiceStatus } from "./InvoiceStatus";
import {
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  Inbox,
  ReceiptText,
} from "lucide-react";

interface InvoicePaginationProps {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  pageSizeOptions?: number[];
}

interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
}

interface InvoiceTableProps {
  invoices: Invoice[];
  onSelectInvoice?: (invoice: Invoice) => void;
  activeId?: string | null;
  emptyState?: ReactNode;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  emptyStateAction?: EmptyStateAction;
  pagination?: InvoicePaginationProps;
}

const DEFAULT_PAGE_SIZES = [10, 20, 50, 100];
const ROW_HEIGHT = 72;

function truncateAddr(addr: string) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function clampPage(page: number, totalPages: number) {
  return Math.min(Math.max(page, 1), Math.max(totalPages, 1));
}

function InvoiceEmptyState({
  title = "No invoices yet",
  description = "Create your first invoice to start populating the ledger.",
  action = {
    label: "Create Your First Invoice",
    href: "/dashboard",
  },
}: {
  title?: string;
  description?: string;
  action?: EmptyStateAction;
}) {
  const actionClasses =
    "inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all";

  const actionNode = action?.href ? (
    <Link
      href={action.href}
      className={`${actionClasses} bg-primary text-black hover:bg-primary-hover shadow-[0_0_15px_rgba(0,212,170,0.1)]`}
    >
      <FilePlus2 className="w-4 h-4" />
      <span>{action.label}</span>
    </Link>
  ) : (
    <Button
      type="button"
      onClick={action?.onClick}
      className={`${actionClasses} bg-primary text-black hover:bg-primary-hover shadow-[0_0_15px_rgba(0,212,170,0.1)] border-0`}
    >
      <FilePlus2 className="w-4 h-4" />
      <span>{action?.label ?? "Create Your First Invoice"}</span>
    </Button>
  );

  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-primary/20 bg-[#0d131a] shadow-[0_0_30px_rgba(0,212,170,0.08)]">
          <Inbox className="h-9 w-9 text-primary" />
        </div>
      </div>

      <div className="max-w-md space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">
          Empty Ledger
        </p>
        <h3 className="text-sm font-bold uppercase tracking-wider text-white">
          {title}
        </h3>
        <p className="text-xs leading-relaxed text-slate-500">{description}</p>
      </div>

      <div className="mt-8">{actionNode}</div>
    </div>
  );
}

function InvoicePagination({
  page,
  limit,
  total,
  totalPages,
  onPageChange,
  onLimitChange,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
}: InvoicePaginationProps) {
  const [pageInput, setPageInput] = useState(String(page));

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  const startItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = total === 0 ? 0 : Math.min(page * limit, total);

  const handleCommitPage = () => {
    const parsed = Number.parseInt(pageInput, 10);
    if (Number.isNaN(parsed)) {
      setPageInput(String(page));
      return;
    }

    onPageChange(clampPage(parsed, totalPages));
  };

  const options = useMemo(() => {
    const base = new Set(pageSizeOptions);
    base.add(limit);
    return Array.from(base).sort((a, b) => a - b);
  }, [limit, pageSizeOptions]);

  return (
    <div className="border-t border-border/60 bg-[#080c10]/55 px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Items per page
          </p>
          <select
            value={limit}
            onChange={(event) => onLimitChange(Number(event.target.value))}
            className="min-w-[140px] rounded border border-border bg-[#0b1117] px-3 py-2 font-mono text-xs text-white outline-none transition-colors focus:border-primary"
          >
            {options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end lg:justify-end">
          <label className="space-y-1.5">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Jump to page
            </span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={pageInput}
              onChange={(event) => setPageInput(event.target.value)}
              onBlur={handleCommitPage}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleCommitPage();
                }
              }}
              className="w-28 rounded border border-border bg-[#0b1117] px-3 py-2 font-mono text-xs text-white outline-none transition-colors focus:border-primary"
            />
          </label>

          <div className="space-y-1.5">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Navigation
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-border bg-[#0b1117] text-slate-200 hover:bg-slate-900 hover:text-white"
                onClick={() => onPageChange(clampPage(page - 1, totalPages))}
                disabled={page <= 1}
              >
                <ChevronLeft className="mr-1.5 h-3.5 w-3.5" />
                Prev
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-border bg-[#0b1117] text-slate-200 hover:bg-slate-900 hover:text-white"
                onClick={() => onPageChange(clampPage(page + 1, totalPages))}
                disabled={page >= totalPages}
              >
                Next
                <ChevronRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-1 border-t border-border/30 pt-3 text-[10px] font-mono uppercase tracking-wider text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <span>
          Showing {startItem}-{endItem} of {total} invoices
        </span>
        <span>
          Page {page} of {totalPages}
        </span>
      </div>
    </div>
  );
}

export function InvoiceTable({
  invoices,
  onSelectInvoice,
  activeId,
  emptyState,
  emptyStateTitle,
  emptyStateDescription,
  emptyStateAction,
  pagination,
}: InvoiceTableProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: invoices.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  useEffect(() => {
    if (parentRef.current) {
      parentRef.current.scrollTop = 0;
    }
  }, [pagination?.page, pagination?.limit, invoices.length]);

  const virtualRows = rowVirtualizer.getVirtualItems();
  const rowsToRender =
    virtualRows.length > 0
      ? virtualRows
      : invoices.map((invoice, index) => ({
          index,
          start: index * ROW_HEIGHT,
          key: invoice.id,
        }));
  const totalHeight =
    virtualRows.length > 0
      ? rowVirtualizer.getTotalSize()
      : invoices.length * ROW_HEIGHT;

  const emptyNode = emptyState ?? (
    <InvoiceEmptyState
      title={emptyStateTitle}
      description={emptyStateDescription}
      action={emptyStateAction}
    />
  );

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border/60 bg-[#080c10]/70 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">
              <ReceiptText className="h-3.5 w-3.5 text-primary" />
              Invoice Ledger
            </p>
            <p className="text-xs text-slate-500">
              Browse, filter, and inspect tokenized trade obligations.
            </p>
          </div>

          {pagination && invoices.length > 0 && (
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
              {pagination.total} matching invoices
            </div>
          )}
        </div>
      </div>

      {invoices.length === 0 ? (
        <div className="bg-[#080c10]/40">{emptyNode}</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <div className="min-w-[920px]">
              <div className="grid grid-cols-[1.15fr_1.15fr_1fr_0.8fr_0.95fr_0.75fr] border-b border-border/60 bg-[#080c10]/80 px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                <div>Invoice ID</div>
                <div>Buyer</div>
                <div>Face Value</div>
                <div>Discount</div>
                <div>Due Date</div>
                <div>Status</div>
              </div>

              <div ref={parentRef} className="max-h-[65vh] overflow-auto">
                <div
                  className="relative w-full"
                  style={{ height: `${totalHeight}px` }}
                >
                  {rowsToRender.map((virtualRow) => {
                    const invoice = invoices[virtualRow.index];
                    const isActive = activeId === invoice.id;

                    return (
                      <button
                        key={invoice.id}
                        type="button"
                        onClick={() => onSelectInvoice?.(invoice)}
                        disabled={!onSelectInvoice}
                        aria-pressed={isActive}
                        className={`absolute left-0 top-0 grid w-full grid-cols-[1.15fr_1.15fr_1fr_0.8fr_0.95fr_0.75fr] items-center border-b border-border/30 px-5 text-left font-mono text-xs transition-colors ${
                          onSelectInvoice ? "cursor-pointer" : "cursor-default"
                        } ${
                          isActive
                            ? "bg-primary/5 text-primary"
                            : "hover:bg-slate-900/50"
                        }`}
                        style={{
                          height: `${ROW_HEIGHT}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <div className="font-bold text-primary">
                          {truncateAddr(invoice.id)}
                        </div>
                        <div className="text-slate-400">
                          {truncateAddr(invoice.buyer)}
                        </div>
                        <div className="font-bold text-white">
                          {formatAmount(invoice.faceValue, invoice.asset)}
                        </div>
                        <div className="text-slate-300">
                          {invoice.discountBps > 0
                            ? `${(invoice.discountBps / 100).toFixed(2)}%`
                            : "—"}
                        </div>
                        <div className="text-slate-400">
                          {new Date(
                            invoice.dueDate * 1000,
                          ).toLocaleDateString()}
                        </div>
                        <div className="flex justify-start">
                          <InvoiceStatus status={invoice.status} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {pagination && <InvoicePagination {...pagination} />}
        </>
      )}
    </div>
  );
}
