import { formatAmount } from "@/lib/assets";
import { buildInvoiceTimeline } from "@/lib/invoiceTimeline";
import type { Invoice } from "@/types";

const PAGE_MARGIN = 48;
const LABEL_WIDTH = 132;
const LINE_HEIGHT = 15;

function formatDiscountRate(discountBps: number): string {
  if (!discountBps) return "—";
  return `${(discountBps / 100).toFixed(2)}%`;
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp * 1000));
}

/** Filename of the exported document, e.g. `trusttrove-invoice-a1b2c3d4.pdf`. */
export function invoicePdfFileName(invoice: Invoice): string {
  return `trusttrove-invoice-${invoice.id.slice(0, 8)}.pdf`;
}

export interface InvoicePdfField {
  label: string;
  value: string;
}

export interface InvoicePdfTimelineEntry {
  label: string;
  timestampLabel: string;
  txHash: string | null;
}

/** Everything the exported PDF renders, resolved from a single invoice. */
export interface InvoicePdfContent {
  title: string;
  fields: InvoicePdfField[];
  timeline: InvoicePdfTimelineEntry[];
}

/**
 * Collects the invoice details and status timeline shown in the exported PDF.
 *
 * Kept separate from the jsPDF drawing so the content is unit-testable (and
 * reusable) without loading a browser-only PDF library.
 *
 * @param invoice - The invoice to export.
 * @returns The title, detail fields, and timeline entries to draw.
 */
export function buildInvoicePdfContent(invoice: Invoice): InvoicePdfContent {
  return {
    title: "TrusTrove Invoice",
    fields: [
      { label: "Invoice ID", value: invoice.id },
      { label: "Status", value: invoice.status },
      {
        label: "Face value",
        value: formatAmount(invoice.faceValue, invoice.asset),
      },
      {
        label: "Discount rate",
        value: formatDiscountRate(invoice.discountBps),
      },
      {
        label: "Funded amount",
        value: formatAmount(invoice.fundedAmount, invoice.asset),
      },
      { label: "Issuer", value: invoice.issuer },
      { label: "Buyer", value: invoice.buyer },
      { label: "Due date", value: formatDate(invoice.dueDate) },
    ],
    timeline: buildInvoiceTimeline(invoice).map((entry) => ({
      label: entry.label,
      timestampLabel: entry.timestampLabel,
      txHash: entry.txHash,
    })),
  };
}

/**
 * Generates and downloads a PDF record of the invoice — id, status, amounts,
 * parties, and the full status timeline.
 *
 * Runs entirely client-side and only needs the invoice already loaded on the
 * page, so it works on read-only public invoice pages with no wallet
 * connected. jsPDF is imported on demand to keep it out of the initial bundle.
 *
 * @param invoice - The invoice to export.
 * @returns Resolves once the browser download has been triggered.
 */
export async function generateInvoicePdf(invoice: Invoice): Promise<void> {
  const { jsPDF } = await import("jspdf");

  const content = buildInvoicePdfContent(invoice);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - PAGE_MARGIN * 2;
  let y = PAGE_MARGIN;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - PAGE_MARGIN) {
      doc.addPage();
      y = PAGE_MARGIN;
    }
  };

  const writeHeading = (text: string) => {
    ensureSpace(30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(text, PAGE_MARGIN, y);
    y += 20;
  };

  const writeField = (label: string, value: string) => {
    const lines = doc.splitTextToSize(
      value,
      contentWidth - LABEL_WIDTH,
    ) as string[];
    ensureSpace(lines.length * LINE_HEIGHT + 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(label.toUpperCase(), PAGE_MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    lines.forEach((line, index) =>
      doc.text(line, PAGE_MARGIN + LABEL_WIDTH, y + index * LINE_HEIGHT),
    );
    y += Math.max(lines.length, 1) * LINE_HEIGHT + 6;
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0);
  doc.text(content.title, PAGE_MARGIN, y);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`Generated ${new Date().toISOString()}`, PAGE_MARGIN, y);
  y += 26;
  doc.setTextColor(0, 0, 0);

  writeHeading("Invoice details");
  content.fields.forEach((field) => writeField(field.label, field.value));

  y += 10;
  writeHeading("Status timeline");
  content.timeline.forEach((entry) =>
    writeField(
      entry.label,
      entry.txHash
        ? `${entry.timestampLabel}  ·  tx ${entry.txHash}`
        : entry.timestampLabel,
    ),
  );

  doc.save(invoicePdfFileName(invoice));
}
