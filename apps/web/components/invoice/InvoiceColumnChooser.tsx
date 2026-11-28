"use client";

import React from "react";
import { INVOICE_COLUMNS, type InvoiceColumnId } from "@/lib/invoice-columns";

export interface InvoiceColumnChooserProps {
  visibleColumns?: InvoiceColumnId[];
  onChange?: (columns: InvoiceColumnId[]) => void;
  columns?: InvoiceColumnId[];
  onColumnsChange?: (columns: InvoiceColumnId[]) => void;
}

export function InvoiceColumnChooser(props: InvoiceColumnChooserProps) {
  const visible =
    props.visibleColumns ?? props.columns ?? INVOICE_COLUMNS.map((c) => c.id);
  const emit = props.onChange ?? props.onColumnsChange ?? (() => {});

  const toggle = (id: InvoiceColumnId) => {
    const next = visible.includes(id)
      ? visible.filter((c) => c !== id)
      : [...visible, id];
    emit(next);
  };

  return (
    <div
      className="rounded border border-border bg-card p-3"
      role="group"
      aria-label="Column chooser"
    >
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Columns
      </p>
      <div className="space-y-2">
        {INVOICE_COLUMNS.map((col) => (
          <label
            key={col.id}
            className="flex items-center gap-2 text-xs text-foreground"
          >
            <input
              type="checkbox"
              checked={visible.includes(col.id)}
              disabled={col.essential}
              onChange={() => toggle(col.id)}
            />
            {col.label}
          </label>
        ))}
      </div>
    </div>
  );
}

export default InvoiceColumnChooser;
