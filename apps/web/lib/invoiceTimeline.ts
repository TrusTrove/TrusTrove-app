import type { Invoice, InvoiceStatus } from "@/types";

export type TimelineStepKey =
  | "created"
  | "listed"
  | "funded"
  | "shipped"
  | "issuerConfirmed"
  | "buyerConfirmed"
  | "settled";

export interface TimelineStepDefinition {
  key: TimelineStepKey;
  label: string;
}

/**
 * An invoice plus the optional timeline metadata fields older indexer
 * responses and legacy contract events may carry (camelCase or snake_case).
 */
export type InvoiceWithTimelineMetadata = Invoice & {
  listedAt?: number | null;
  issuerConfirmedAt?: number | null;
  buyerConfirmedAt?: number | null;
  defaultedAt?: number | null;
  transactionHashes?: Partial<Record<TimelineStepKey, string>>;
  txHashes?: Partial<Record<TimelineStepKey, string>>;
  createdTxHash?: string;
  listedTxHash?: string;
  fundedTxHash?: string;
  shippedTxHash?: string;
  issuerConfirmedTxHash?: string;
  buyerConfirmedTxHash?: string;
  repaidTxHash?: string;
  defaultedTxHash?: string;
  created_tx_hash?: string;
  listed_tx_hash?: string;
  funded_tx_hash?: string;
  shipped_tx_hash?: string;
  issuer_confirmed_tx_hash?: string;
  buyer_confirmed_tx_hash?: string;
  repaid_tx_hash?: string;
  defaulted_tx_hash?: string;
};

/**
 * The full lifecycle shown by the invoice status timeline, in order. The
 * invoice's current position is derived from its on-chain status and
 * confirmation flags.
 */
export const TIMELINE_STEPS: TimelineStepDefinition[] = [
  { key: "created", label: "Created" },
  { key: "listed", label: "Listed for Financing" },
  { key: "funded", label: "Funded by Pool" },
  { key: "shipped", label: "Marked as Shipped" },
  { key: "issuerConfirmed", label: "Delivery Confirmed - Issuer" },
  { key: "buyerConfirmed", label: "Delivery Confirmed - Buyer" },
  { key: "settled", label: "Repaid / Defaulted" },
];

const statusProgress: Record<InvoiceStatus, number> = {
  Created: 0,
  Listed: 1,
  Funded: 2,
  Active: 4,
  Confirmed: 5,
  Repaid: 6,
  Defaulted: 6,
};

/** Index into {@link TIMELINE_STEPS} the invoice has reached. */
export function getCurrentTimelineIndex(invoice: Invoice): number {
  if (invoice.status === "Repaid" || invoice.status === "Defaulted") return 6;
  if (invoice.buyerConfirmed || invoice.status === "Confirmed") return 5;
  if (
    invoice.issuerConfirmed ||
    invoice.shippedAt ||
    invoice.status === "Active"
  )
    return 4;
  return statusProgress[invoice.status] ?? 0;
}

function getTimestamp(
  invoice: InvoiceWithTimelineMetadata,
  key: TimelineStepKey,
): number | null {
  switch (key) {
    case "created":
      return invoice.createdAt ?? null;
    case "listed":
      return invoice.listedAt ?? null;
    case "funded":
      return invoice.fundedAt ?? null;
    case "shipped":
    case "issuerConfirmed":
      return invoice.shippedAt || invoice.issuerConfirmedAt || null;
    case "buyerConfirmed":
      return invoice.buyerConfirmedAt ?? null;
    case "settled":
      return invoice.status === "Defaulted"
        ? (invoice.defaultedAt ?? null)
        : (invoice.repaidAt ?? null);
    default:
      return null;
  }
}

function getTxHash(
  invoice: InvoiceWithTimelineMetadata,
  key: TimelineStepKey,
): string | null {
  const mapHash = invoice.transactionHashes?.[key] || invoice.txHashes?.[key];
  if (mapHash) return mapHash;

  const fieldNames: Record<
    TimelineStepKey,
    (keyof InvoiceWithTimelineMetadata)[]
  > = {
    created: ["createdTxHash", "created_tx_hash"],
    listed: ["listedTxHash", "listed_tx_hash"],
    funded: ["fundedTxHash", "funded_tx_hash"],
    shipped: ["shippedTxHash", "shipped_tx_hash"],
    issuerConfirmed: [
      "issuerConfirmedTxHash",
      "issuer_confirmed_tx_hash",
      "shippedTxHash",
      "shipped_tx_hash",
    ],
    buyerConfirmed: ["buyerConfirmedTxHash", "buyer_confirmed_tx_hash"],
    settled:
      invoice.status === "Defaulted"
        ? ["defaultedTxHash", "defaulted_tx_hash"]
        : ["repaidTxHash", "repaid_tx_hash"],
  };

  for (const fieldName of fieldNames[key]) {
    const value = invoice[fieldName];
    if (typeof value === "string" && value.length > 0) return value;
  }

  return null;
}

/** Formats a Unix timestamp (seconds) for display, or "Pending" when unset. */
export function formatTimelineTimestamp(timestamp?: number | null): string {
  if (!timestamp) return "Pending";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp * 1000));
}

/** Shortens a transaction hash to `first8...last6` for display. */
export function truncateTxHash(hash: string): string {
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

export interface InvoiceTimelineEntry {
  key: TimelineStepKey;
  /** Step label, with the settlement step resolved to Repaid/Defaulted. */
  label: string;
  /** True once the step has been reached, i.e. it is not still pending. */
  isComplete: boolean;
  /** True for the step the invoice is currently at. */
  isCurrent: boolean;
  /** Unix timestamp (seconds) the step happened at, when known. */
  timestamp: number | null;
  /** {@link timestamp} formatted for display, or "Pending". */
  timestampLabel: string;
  /** On-chain transaction hash that advanced this step, when recorded. */
  txHash: string | null;
}

/**
 * Resolves the invoice's full timeline: one entry per lifecycle step with its
 * completion state, timestamp, and transaction hash. Shared by the on-screen
 * timeline component and the PDF export.
 *
 * @param invoice - The invoice to build the timeline for.
 * @returns One entry per {@link TIMELINE_STEPS} step, in lifecycle order.
 */
export function buildInvoiceTimeline(invoice: Invoice): InvoiceTimelineEntry[] {
  const timelineInvoice = invoice as InvoiceWithTimelineMetadata;
  const currentIndex = getCurrentTimelineIndex(invoice);
  const settledLabel =
    invoice.status === "Repaid"
      ? "Repaid"
      : invoice.status === "Defaulted"
        ? "Defaulted"
        : "Repaid / Defaulted";

  return TIMELINE_STEPS.map((step, index) => {
    const timestamp = getTimestamp(timelineInvoice, step.key);
    return {
      key: step.key,
      label: step.key === "settled" ? settledLabel : step.label,
      isComplete: index <= currentIndex,
      isCurrent: index === currentIndex,
      timestamp,
      timestampLabel: formatTimelineTimestamp(timestamp),
      txHash: getTxHash(timelineInvoice, step.key),
    };
  });
}
