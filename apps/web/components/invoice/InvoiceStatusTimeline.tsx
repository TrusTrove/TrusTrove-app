"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Banknote,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FilePlus2,
  PackageCheck,
  ReceiptText,
  Send,
  ShieldCheck,
} from "lucide-react";
import { Invoice, InvoiceStatus } from "@/types";

type TimelineStepKey =
  | "created"
  | "listed"
  | "funded"
  | "shipped"
  | "issuerConfirmed"
  | "buyerConfirmed"
  | "settled";

type TimelineStep = {
  key: TimelineStepKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type InvoiceWithTimelineMetadata = Invoice & {
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

interface InvoiceStatusTimelineProps {
  invoice: Invoice;
}

const steps: TimelineStep[] = [
  { key: "created", label: "Created", icon: FilePlus2 },
  { key: "listed", label: "Listed for Financing", icon: ReceiptText },
  { key: "funded", label: "Funded by Pool", icon: Banknote },
  { key: "shipped", label: "Marked as Shipped", icon: Send },
  {
    key: "issuerConfirmed",
    label: "Delivery Confirmed - Issuer",
    icon: PackageCheck,
  },
  {
    key: "buyerConfirmed",
    label: "Delivery Confirmed - Buyer",
    icon: ShieldCheck,
  },
  { key: "settled", label: "Repaid / Defaulted", icon: CheckCircle2 },
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

function getCurrentIndex(invoice: Invoice) {
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
) {
  switch (key) {
    case "created":
      return invoice.createdAt;
    case "listed":
      return invoice.listedAt;
    case "funded":
      return invoice.fundedAt;
    case "shipped":
    case "issuerConfirmed":
      return invoice.shippedAt || invoice.issuerConfirmedAt;
    case "buyerConfirmed":
      return invoice.buyerConfirmedAt;
    case "settled":
      return invoice.status === "Defaulted"
        ? invoice.defaultedAt
        : invoice.repaidAt;
    default:
      return null;
  }
}

function getTxHash(invoice: InvoiceWithTimelineMetadata, key: TimelineStepKey) {
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

function formatTimestamp(timestamp?: number | null) {
  if (!timestamp) return "Pending";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp * 1000));
}

function truncateHash(hash: string) {
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

export function InvoiceStatusTimeline({ invoice }: InvoiceStatusTimelineProps) {
  const timelineInvoice = invoice as InvoiceWithTimelineMetadata;
  const currentIndex = getCurrentIndex(invoice);
  const settledLabel =
    invoice.status === "Repaid"
      ? "Repaid"
      : invoice.status === "Defaulted"
        ? "Defaulted"
        : "Repaid / Defaulted";

  return (
    <ol className="relative space-y-0">
      {steps.map((step, index) => {
        const isComplete = index <= currentIndex;
        const isCurrent = index === currentIndex;
        const isFuture = index > currentIndex;
        const Icon = step.icon;
        const label = step.key === "settled" ? settledLabel : step.label;
        const timestamp = getTimestamp(timelineInvoice, step.key);
        const txHash = getTxHash(timelineInvoice, step.key);

        return (
          <li
            key={step.key}
            className={`relative grid grid-cols-[2rem_minmax(0,1fr)] gap-3 pb-6 last:pb-0 ${isFuture ? "opacity-40" : "opacity-100"}`}
          >
            {index < steps.length - 1 && (
              <span
                className={`absolute left-4 top-8 h-[calc(100%-2rem)] border-l ${
                  index < currentIndex
                    ? "border-teal-400"
                    : "border-dashed border-slate-600"
                }`}
                aria-hidden="true"
              />
            )}

            <div className="relative z-10 flex h-8 w-8 items-center justify-center">
              {isCurrent && (
                <motion.span
                  className="absolute h-8 w-8 rounded-full bg-teal-400/25"
                  animate={{ opacity: [0.25, 0.8, 0.25], scale: [1, 1.35, 1] }}
                  transition={{
                    duration: 1.8,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              )}
              <span
                className={`relative flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
                  isComplete
                    ? "border-teal-400 bg-teal-400 text-slate-950 shadow-[0_0_18px_rgba(45,212,191,0.25)]"
                    : "border-slate-600 bg-card text-slate-500"
                }`}
              >
                {isFuture ? (
                  <span className="h-2.5 w-2.5 rounded-full border border-slate-500" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
              </span>
            </div>

            <div className="min-w-0 pt-0.5">
              <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-2">
                  <Icon
                    className={`${isComplete ? "text-teal-300" : "text-slate-500"} h-3.5 w-3.5 shrink-0`}
                  />
                  <span
                    className={`truncate font-mono text-xs font-bold uppercase ${isComplete ? "text-white" : "text-slate-400"}`}
                  >
                    {label}
                  </span>
                </div>
                <span className="font-mono text-[10px] uppercase text-slate-500 sm:text-right">
                  {formatTimestamp(timestamp)}
                </span>
              </div>

              <div className="mt-1 flex min-w-0 items-center gap-1.5 font-mono text-[10px] uppercase text-slate-500">
                <Clock3 className="h-3 w-3 shrink-0" />
                {txHash ? (
                  <a
                    href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-w-0 items-center gap-1 text-teal-300 transition-colors hover:text-teal-200"
                  >
                    <span className="truncate">{truncateHash(txHash)}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                ) : (
                  <span className="truncate">No tx hash recorded</span>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
