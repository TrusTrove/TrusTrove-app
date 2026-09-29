"use client";

import React, {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useVirtualizer } from "@tanstack/react-virtual";
import { formatAmount } from "@/lib/assets";
import { Invoice } from "@/types";
import { Button } from "@/components/ui/button";
import { InvoiceStatus } from "./InvoiceStatus";
import { InvoiceCard } from "./InvoiceCard";
import { truncateAddress } from "@/lib/format";
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
  role?: "issuer" | "buyer" | "lp";
  /**
   * Opt into multi-select mode: adds a checkbox per row, a "select all on
   * page" checkbox in the header, and a selection toolbar. Off by default, so
   * existing single-select callers are unaffected.
   */
  selectable?: boolean;
  /**
   * Selected invoice ids. Passing this makes the selection controlled; omit it
   * to let the table track its own selection internally.
   */
  selectedIds?: string[];
  /** Called with the next set of selected ids whenever the selection changes. */
  onSelectionChange?: (ids: string[]) => void;
}

const DEFAULT_PAGE_SIZES = [10, 20, 50, 100];
const ROW_HEIGHT = 72;

// The checkbox column is fixed-width so it does not steal space from the six
// proportional data columns below.
const SELECT_COL_FLEX = "0 0 2.5rem";

const CHECKBOX_CLASSES =
  "h-4 w-4 cursor-pointer accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-[#080c10]";

// Shared flex proportions matching the 6-column layout.
const COL_FLEX = ["1.15", "1.15", "1", "0.8", "0.95", "0.75"] as const;

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
  role,
  selectable = false,
  selectedIds,
  onSelectionChange,
}: InvoiceTableProps) {
  const parentRef = useRef<HTMLTableSectionElement | null>(null);
  // rowRefs tracks rendered <tr> elements so the roving-tabindex effect can
  // imperatively focus the newly active row after an arrow-key press.
  const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());
  const [focusedIndex, setFocusedIndex] = useState(0);
  // Uncontrolled fallback: used only while `selectedIds` is not supplied.
  const [internalSelectedIds, setInternalSelectedIds] = useState<string[]>([]);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const isSelectionControlled = selectedIds !== undefined;
  const selection = isSelectionControlled ? selectedIds : internalSelectedIds;

  const selectedSet = useMemo(() => new Set(selection), [selection]);

  const commitSelection = useCallback(
    (next: string[]) => {
      if (!isSelectionControlled) setInternalSelectedIds(next);
      onSelectionChange?.(next);
    },
    [isSelectionControlled, onSelectionChange],
  );

  const toggleRowSelection = useCallback(
    (id: string) => {
      const next = selectedSet.has(id)
        ? selection.filter((selectedId) => selectedId !== id)
        : [...selection, id];
      commitSelection(next);
    },
    [commitSelection, selectedSet, selection],
  );

  const pageIds = useMemo(
    () => invoices.map((invoice) => invoice.id),
    [invoices],
  );
  const selectedOnPageCount = useMemo(
    () => pageIds.filter((id) => selectedSet.has(id)).length,
    [pageIds, selectedSet],
  );
  const allOnPageSelected =
    pageIds.length > 0 && selectedOnPageCount === pageIds.length;

  // "Select all" is scoped to the current page, so selections made on other
  // pages survive paging back and forth.
  const toggleAllOnPage = useCallback(() => {
    if (allOnPageSelected) {
      const pageIdSet = new Set(pageIds);
      commitSelection(selection.filter((id) => !pageIdSet.has(id)));
      return;
    }
    const merged = new Set(selection);
    pageIds.forEach((id) => merged.add(id));
    commitSelection(Array.from(merged));
  }, [allOnPageSelected, commitSelection, pageIds, selection]);

  const clearSelection = useCallback(
    () => commitSelection([]),
    [commitSelection],
  );

  // `indeterminate` is a DOM-only property, so it has to be set imperatively.
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        selectedOnPageCount > 0 && !allOnPageSelected;
    }
  }, [selectedOnPageCount, allOnPageSelected]);

  // Move DOM focus whenever the roving index changes.
  useEffect(() => {
    const row = rowRefs.current.get(focusedIndex);
    if (row && document.activeElement !== row) {
      row.focus({ preventScroll: false });
    }
  }, [focusedIndex]);

  const handleRowKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTableRowElement>, index: number) => {
      if (!onSelectInvoice) return;
      // Keys pressed inside the row checkbox belong to the checkbox: without
      // this, Space would both toggle it and fire onSelectInvoice.
      if (event.target !== event.currentTarget) return;
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setFocusedIndex((i) => Math.min(i + 1, invoices.length - 1));
          break;
        case "ArrowUp":
          event.preventDefault();
          setFocusedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Home":
          event.preventDefault();
          setFocusedIndex(0);
          break;
        case "End":
          event.preventDefault();
          setFocusedIndex(invoices.length - 1);
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          onSelectInvoice(invoices[index]);
          break;
      }
    },
    [invoices, onSelectInvoice],
  );

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

      {selectable && (
        <div
          className="flex items-center justify-between gap-3 border-b border-border/60 bg-[#080c10]/50 px-4 py-2.5 sm:px-5"
          role="status"
          aria-live="polite"
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {selection.length} selected
          </span>
          {selection.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-border bg-[#0b1117] text-[10px] font-bold uppercase tracking-wider text-slate-200 hover:bg-slate-900 hover:text-white"
              onClick={clearSelection}
            >
              Clear selection
            </Button>
          )}
        </div>
      )}

      {invoices.length === 0 ? (
        <div className="bg-[#080c10]/40">{emptyNode}</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            {/* display:block overrides UA table layout so thead/tbody can use
                flex rows whose column widths are kept in sync via COL_FLEX. */}
            <table
              className="min-w-[920px] w-full"
              style={{ display: "block" }}
              role="grid"
              aria-label="Invoice Ledger"
            >
              <thead style={{ display: "block" }}>
                <tr className="flex border-b border-border/60 bg-[#080c10]/80 px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  {selectable && (
                    <th
                      scope="col"
                      style={{ flex: SELECT_COL_FLEX }}
                      className="text-left"
                    >
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        className={CHECKBOX_CLASSES}
                        checked={allOnPageSelected}
                        onChange={toggleAllOnPage}
                        aria-label="Select all invoices on this page"
                      />
                    </th>
                  )}
                  <th
                    scope="col"
                    style={{ flex: COL_FLEX[0] }}
                    className="text-left"
                  >
                    Invoice ID
                  </th>
                  <th
                    scope="col"
                    style={{ flex: COL_FLEX[1] }}
                    className="text-left"
                  >
                    Buyer
                  </th>
                  <th
                    scope="col"
                    style={{ flex: COL_FLEX[2] }}
                    className="text-left"
                  >
                    Face Value
                  </th>
                  <th
                    scope="col"
                    style={{ flex: COL_FLEX[3] }}
                    className="text-left"
                  >
                    Discount
                  </th>
                  <th
                    scope="col"
                    style={{ flex: COL_FLEX[4] }}
                    className="text-left"
                  >
                    Due Date
                  </th>
                  <th
                    scope="col"
                    style={{ flex: COL_FLEX[5] }}
                    className="text-left"
                  >
                    Status
                  </th>
                </tr>
              </thead>

              {/* tbody is the virtual-scroll container: height=totalHeight lets the
                  browser know the full scrollable extent; maxHeight clips it visually. */}
              <tbody
                ref={parentRef}
                style={{
                  display: "block",
                  position: "relative",
                  overflowY: "auto",
                  maxHeight: "65vh",
                  height: `${totalHeight}px`,
                }}
              >
                {rowsToRender.map((virtualRow) => {
                  const invoice = invoices[virtualRow.index];
                  const isActive = activeId === invoice.id;
                  const isChecked = selectedSet.has(invoice.id);

                  const isFocusable = !!onSelectInvoice;
                  return (
                    <tr
                      key={invoice.id}
                      ref={(el) => {
                        if (el) rowRefs.current.set(virtualRow.index, el);
                        else rowRefs.current.delete(virtualRow.index);
                      }}
                      aria-selected={selectable ? isChecked : isActive}
                      // Roving tabindex: only the focused row is in the tab order.
                      tabIndex={
                        isFocusable
                          ? virtualRow.index === focusedIndex
                            ? 0
                            : -1
                          : undefined
                      }
                      onClick={() => {
                        if (onSelectInvoice) {
                          setFocusedIndex(virtualRow.index);
                          onSelectInvoice(invoice);
                        }
                      }}
                      onFocus={() => setFocusedIndex(virtualRow.index)}
                      onKeyDown={(e) => handleRowKeyDown(e, virtualRow.index)}
                      className={`absolute left-0 top-0 flex w-full items-center border-b border-border/30 px-5 font-mono text-xs transition-colors ${
                        onSelectInvoice ? "cursor-pointer" : "cursor-default"
                      } ${
                        isActive
                          ? "bg-primary/5 text-primary"
                          : "hover:bg-slate-900/50"
                      } ${
                        isFocusable
                          ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                          : ""
                      }`}
                      style={{
                        height: `${ROW_HEIGHT}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      {selectable && (
                        <td
                          style={{ flex: SELECT_COL_FLEX }}
                          // Clicking the checkbox must not also trigger the
                          // row's single-select handler.
                          onClick={(event) => event.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            className={CHECKBOX_CLASSES}
                            checked={isChecked}
                            onChange={() => toggleRowSelection(invoice.id)}
                            aria-label={`Select invoice ${invoice.id}`}
                          />
                        </td>
                      )}
                      <td
                        style={{ flex: COL_FLEX[0] }}
                        className="font-bold text-primary"
                      >
                        {truncateAddress(invoice.id)}
                      </td>
                      <td
                        style={{ flex: COL_FLEX[1] }}
                        className="text-slate-400"
                      >
                        {truncateAddress(invoice.buyer)}
                      </td>
                      <td
                        style={{ flex: COL_FLEX[2] }}
                        className="font-bold text-white"
                      >
                        {formatAmount(invoice.faceValue, invoice.asset)}
                      </td>
                      <td
                        style={{ flex: COL_FLEX[3] }}
                        className="text-slate-300"
                      >
                        {invoice.discountBps > 0
                          ? `${(invoice.discountBps / 100).toFixed(2)}%`
                          : "—"}
                      </td>
                      <td
                        style={{ flex: COL_FLEX[4] }}
                        className="text-slate-400"
                      >
                        {new Date(invoice.dueDate * 1000).toLocaleDateString()}
                      </td>
                      <td
                        style={{ flex: COL_FLEX[5] }}
                        className="flex justify-start"
                      >
                        <InvoiceStatus status={invoice.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards view (hidden on desktop >= md) */}
          <div className="md:hidden space-y-4">
            {invoices.map((invoice) => (
              <InvoiceCard
                key={invoice.id}
                invoice={invoice}
                role={role}
                onSelect={onSelectInvoice}
                isSelected={activeId === invoice.id}
              />
            ))}
          </div>

          {pagination && <InvoicePagination {...pagination} />}
        </>
      )}
    </div>
  );
}
