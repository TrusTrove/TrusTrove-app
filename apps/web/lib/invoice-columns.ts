/**
 * Wallet-scoped invoice table column preferences.
 */

export const INVOICE_COLUMNS = [
  { id: "invoiceId", label: "Invoice ID", essential: true },
  { id: "buyer", label: "Buyer", essential: false },
  { id: "faceValue", label: "Face Value", essential: false },
  { id: "discount", label: "Discount", essential: false },
  { id: "dueDate", label: "Due Date", essential: false },
  { id: "status", label: "Status", essential: true },
] as const;

export type InvoiceColumnId = (typeof INVOICE_COLUMNS)[number]["id"];

export const DEFAULT_INVOICE_COLUMNS: InvoiceColumnId[] = INVOICE_COLUMNS.map(
  (c) => c.id,
);

export function invoiceColumnsKey(address: string): string {
  return `trusttrove_columns_${address}`;
}

export function readStoredInvoiceColumns(
  storageKey: string,
): InvoiceColumnId[] | null {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return null;
    const valid = parsed.filter((id) =>
      INVOICE_COLUMNS.some((c) => c.id === id),
    ) as InvoiceColumnId[];
    // Ensure essential columns are present.
    for (const col of INVOICE_COLUMNS) {
      if (col.essential && !valid.includes(col.id)) valid.push(col.id);
    }
    // Preserve a sensible order: essential first/last? Keep stored order then append missing.
    for (const col of DEFAULT_INVOICE_COLUMNS) {
      if (!valid.includes(col)) valid.push(col);
    }
    return valid;
  } catch {
    return null;
  }
}

export function writeStoredInvoiceColumns(
  storageKey: string,
  columns: InvoiceColumnId[],
): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(columns));
  } catch {
    // ignore
  }
}
