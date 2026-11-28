"use client";

import React from "react";
import { X, ExternalLink, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface TransactionReceipt {
  operation?: string;
  title?: string;
  action?: string;
  txHash?: string;
  transactionHash?: string;
  hash?: string;
  network?: string;
  timestamp?: number | string | Date;
  explorerUrl?: string;
  explorerLink?: string;
  url?: string;
}

export interface TransactionReceiptDrawerProps extends TransactionReceipt {
  open?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  title?: string;
  action?: string;
  receipt?: TransactionReceipt;
}

function resolveHash(props: TransactionReceiptDrawerProps): string {
  const r = props.receipt;
  return (
    props.txHash ||
    props.transactionHash ||
    props.hash ||
    r?.txHash ||
    r?.transactionHash ||
    r?.hash ||
    ""
  );
}

function resolveOperation(props: TransactionReceiptDrawerProps): string {
  const r = props.receipt;
  return (
    props.operation ||
    props.title ||
    props.action ||
    r?.operation ||
    r?.title ||
    r?.action ||
    "Transaction"
  );
}

function resolveNetwork(props: TransactionReceiptDrawerProps): string {
  const r = props.receipt;
  return props.network || r?.network || "Stellar Testnet";
}

function resolveTimestamp(props: TransactionReceiptDrawerProps): string {
  const r = props.receipt;
  const value = props.timestamp ?? r?.timestamp;
  if (value == null) return new Date().toLocaleString();
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === "number") return new Date(value * 1000).toLocaleString();
  return String(value);
}

function resolveExplorerUrl(
  props: TransactionReceiptDrawerProps,
  hash: string,
): string {
  const r = props.receipt;
  const explicit =
    props.explorerUrl ||
    props.explorerLink ||
    props.url ||
    r?.explorerUrl ||
    r?.explorerLink ||
    r?.url;
  if (explicit) return explicit;
  if (!hash) return "#";
  return `https://stellar.expert/explorer/testnet/tx/${hash}`;
}

export function TransactionReceiptDrawer(props: TransactionReceiptDrawerProps) {
  const { open, isOpen, onClose } = props;
  const visible = open ?? isOpen ?? false;
  const [copied, setCopied] = React.useState(false);

  if (!visible) return null;

  const hash = resolveHash(props);
  const operation = resolveOperation(props);
  const network = resolveNetwork(props);
  const timestamp = resolveTimestamp(props);
  const explorerUrl = resolveExplorerUrl(props, hash);

  const handleCopy = async () => {
    if (!hash) return;
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 md:items-center md:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transaction-receipt-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-card border border-border rounded-t-2xl md:rounded-lg p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3
            id="transaction-receipt-title"
            className="text-sm font-bold font-mono uppercase tracking-wider text-foreground"
          >
            Transaction Receipt
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close transaction receipt"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <dl className="space-y-3 text-xs font-mono">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground uppercase">Operation</dt>
            <dd className="text-foreground font-bold text-right">
              {operation}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground uppercase">
              Transaction Hash
            </dt>
            <dd className="text-foreground font-mono text-right break-all">
              {hash || "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground uppercase">Network</dt>
            <dd className="text-foreground font-bold text-right">{network}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground uppercase">Timestamp</dt>
            <dd className="text-foreground font-bold text-right">
              {timestamp}
            </dd>
          </div>
        </dl>

        <div className="mt-5 flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={handleCopy}
            disabled={!hash}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 mr-1" /> Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 mr-1" /> Copy Hash
              </>
            )}
          </Button>
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-primary text-primary-foreground px-3 py-2 text-xs font-bold uppercase"
          >
            Explorer Link
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

export default TransactionReceiptDrawer;
