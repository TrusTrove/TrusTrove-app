"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { PageLayout } from "@/components/shared/PageLayout";
import { useInvoice } from "@/hooks/useInvoices";
import { useInvoiceDetailActions } from "@/hooks/useInvoiceDetailActions";
import { useWalletStore } from "@/store/wallet";
import { InvoiceStatus } from "@/components/invoice/InvoiceStatus";
import { InvoiceStatusTimeline } from "@/components/invoice/InvoiceStatusTimeline";
import { Button } from "@/components/ui/button";
import { TransactionPending } from "@/components/shared/TransactionPending";
import {
  Calendar,
  ShieldAlert,
  Copy,
  Check,
  CircleAlert,
  ArrowLeft,
  ChevronRight,
  FileDown,
  Loader2,
  Lock,
  Users,
  Activity,
  TrendingUp,
  Share2,
} from "lucide-react";
import { formatAmount } from "@/lib/assets";
import { truncateAddress } from "@/lib/format";
import { parseInvoiceResponse } from "@/lib/parsers";
import { generateInvoicePdf } from "@/lib/invoicePdf";

interface InvoiceDetailClientProps {
  invoiceId: string;
  /**
   * The invoice payload the page already fetched server-side for
   * `generateMetadata`, forwarded as-is (plain JSON). Seeding the query with it
   * removes the second no-store round-trip and the "Fetching invoice state"
   * flash (#1118).
   */
  initialInvoice?: unknown;
}

export default function InvoiceDetailClient({
  invoiceId,
  initialInvoice,
}: InvoiceDetailClientProps) {
  const connected = useWalletStore((s) => s.connected);
  const role = useWalletStore((s) => s.role);

  const seedInvoice = useMemo(
    () =>
      initialInvoice === undefined
        ? undefined
        : parseInvoiceResponse(initialInvoice),
    [initialInvoice],
  );

  const { invoice, isLoading, refetch } = useInvoice(invoiceId, {
    initialData: seedInvoice,
  });
  const {
    submitting,
    error,
    showPending,
    pendingHash,
    pendingText,
    setShowPending,
    ship,
    confirm,
    repay,
    markDefault,
  } = useInvoiceDetailActions(invoiceId, refetch);

  // One key at a time keeps the "copied" feedback mutually exclusive, and a
  // single timer makes the reset easy to clean up on unmount (and when another
  // copy is triggered before the previous one expires).
  type CopyKey = "id" | "issuer" | "buyer" | "link";
  const [copiedKey, setCopiedKey] = useState<CopyKey | null>(null);
  const [copyFailedKey, setCopyFailedKey] = useState<CopyKey | null>(null);
  const [copyAnnouncement, setCopyAnnouncement] = useState("");
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState("");
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setInvoiceUrl(window.location.href);
    }
  }, []);

  useEffect(
    () => () => {
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
    },
    [],
  );

  const copyToClipboard = useCallback(async (text: string, key: CopyKey) => {
    if (copyResetTimer.current) {
      clearTimeout(copyResetTimer.current);
      copyResetTimer.current = null;
    }

    try {
      // `navigator.clipboard` is undefined on insecure origins and writeText
      // rejects when permission is denied, so both paths have to be handled.
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setCopyFailedKey(null);
      setCopyAnnouncement("Copied");
    } catch {
      setCopiedKey(null);
      setCopyFailedKey(key);
      setCopyAnnouncement("Copy failed");
    } finally {
      copyResetTimer.current = setTimeout(() => {
        setCopiedKey(null);
        setCopyFailedKey(null);
        setCopyAnnouncement("");
        copyResetTimer.current = null;
      }, 2000);
    }
  }, []);

  /**
   * Builds the invoice PDF client-side. Runs without a connected wallet, so
   * the read-only public invoice pages can export a record too.
   */
  const downloadPdf = async () => {
    if (!invoice || isExportingPdf) return;
    setIsExportingPdf(true);
    setPdfError(null);
    try {
      await generateInvoicePdf(invoice);
    } catch (error) {
      setPdfError(
        error instanceof Error
          ? error.message
          : "Could not generate the invoice PDF.",
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  const shareMessage = useMemo(() => {
    if (!invoice) return "";
    return `TrusTrove Invoice ${invoice.id} — ${formatAmount(invoice.faceValue)} USDC`;
  }, [invoice]);

  const whatsappUrl = useMemo(() => {
    return `https://wa.me/?text=${encodeURIComponent(`${shareMessage} ${invoiceUrl}`)}`;
  }, [invoiceUrl, shareMessage]);

  const telegramUrl = useMemo(() => {
    return `https://t.me/share/url?url=${encodeURIComponent(invoiceUrl)}&text=${encodeURIComponent(shareMessage)}`;
  }, [invoiceUrl, shareMessage]);

  if (isLoading) {
    return (
      <PageLayout>
        <div
          role="status"
          className="flex flex-col items-center justify-center py-20 min-h-[50vh] font-mono text-xs text-primary animate-pulse uppercase"
        >
          Fetching invoice state from ledger...
        </div>
      </PageLayout>
    );
  }

  if (!invoice) {
    return (
      <PageLayout>
        <div className="flex flex-col items-center justify-center py-20 min-h-[50vh] text-center max-w-sm mx-auto space-y-4">
          <ShieldAlert className="w-12 h-12 text-warning" />
          <h1 className="text-base font-bold font-mono text-foreground uppercase">
            Ledger entry not found
          </h1>
          <p className="text-muted-foreground text-xs font-mono">
            The invoice ID: {invoiceId} was not found on-chain. Please verify
            the address.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center border border-border text-foreground font-mono text-xs uppercase px-4 py-2 rounded-md transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Return to Dashboard
          </Link>
        </div>
      </PageLayout>
    );
  }

  const nowSecs = Math.floor(Date.now() / 1000);
  const secondsRemaining = Number(invoice.dueDate) - nowSecs;
  const daysRemaining = Math.ceil(secondsRemaining / (24 * 3600));
  const isOverdue = secondsRemaining < 0;
  const canShip = connected && role === "issuer" && invoice.status === "Funded";
  const canConfirm =
    connected && role === "buyer" && invoice.status === "Active";
  const canRepay =
    connected && role === "buyer" && invoice.status === "Confirmed";
  const canDefault = connected && invoice.status === "Confirmed" && isOverdue;

  return (
    <PageLayout>
      <div className="space-y-6 py-4">
        {/* Shared polite live region for every copy control on the page. */}
        <p role="status" aria-live="polite" className="sr-only">
          {copyAnnouncement}
        </p>

        <nav
          aria-label="Breadcrumb"
          className="text-[10px] font-bold font-mono uppercase tracking-wider"
        >
          <ol className="flex flex-wrap items-center gap-2">
            <li className="flex-shrink-0">
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                Dashboard
              </Link>
            </li>
            <li aria-hidden="true" className="flex-shrink-0">
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            </li>
            <li className="min-w-0">
              <span
                aria-current="page"
                className="text-foreground truncate block"
              >
                Invoice #{truncateAddress(invoice.id)}
              </span>
            </li>
          </ol>
        </nav>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-bold font-mono text-foreground truncate">
                INVOICE AUDIT LEDGER
              </h1>
              <InvoiceStatus status={invoice.status} />
            </div>
            <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground flex-wrap">
              <span className="truncate">
                HASH: <strong className="text-foreground">{invoice.id}</strong>
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(invoice.id, "id")}
                className="inline-flex min-h-6 min-w-6 flex-shrink-0 items-center justify-center rounded p-1.5 -m-1.5 text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label="Copy invoice ID"
              >
                {copyFailedKey === "id" ? (
                  <CircleAlert
                    className="w-3.5 h-3.5 text-destructive"
                    aria-hidden="true"
                  />
                ) : copiedKey === "id" ? (
                  <Check
                    className="w-3.5 h-3.5 text-success"
                    aria-hidden="true"
                  />
                ) : (
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
          <div className="bg-card border border-border rounded px-4 py-2 font-mono text-right flex-shrink-0">
            <span className="text-[10px] text-muted-foreground font-bold uppercase block">
              Face Value Obligations
            </span>
            <span className="text-lg font-bold text-foreground block mt-0.5 truncate">
              {formatAmount(invoice.faceValue)}
            </span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <h2 className="text-xs font-bold font-mono text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-primary" />
            Soroban Transaction Progress
          </h2>
          <InvoiceStatusTimeline invoice={invoice} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-card border border-border rounded-lg p-5 space-y-4">
              <h2 className="text-xs font-bold font-mono text-foreground uppercase tracking-wider border-b border-border/40 pb-2 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-primary" />
                Obligation Parties
              </h2>
              <div className="space-y-4 font-mono text-xs">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 p-2.5 bg-background/40 rounded border border-border/30">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase block">
                      SME Issuer (Vendor)
                    </span>
                    <span className="text-foreground break-all select-all font-bold">
                      {invoice.issuer}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(invoice.issuer, "issuer")}
                    className="self-end sm:self-center border border-border bg-card text-muted-foreground hover:text-foreground px-2 py-1 rounded flex items-center gap-1 min-h-[32px]"
                    aria-label="Copy issuer address"
                  >
                    {copyFailedKey === "issuer" ? (
                      <CircleAlert
                        className="w-3 h-3 text-destructive"
                        aria-hidden="true"
                      />
                    ) : copiedKey === "issuer" ? (
                      <Check
                        className="w-3 h-3 text-success"
                        aria-hidden="true"
                      />
                    ) : (
                      <Copy className="w-3 h-3" aria-hidden="true" />
                    )}
                    <span aria-hidden="true">
                      {copiedKey === "issuer" ? "COPIED" : "COPY"}
                    </span>
                  </button>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 p-2.5 bg-background/40 rounded border border-border/30">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase block">
                      Buyer Party (Debtor)
                    </span>
                    <span className="text-foreground break-all select-all font-bold">
                      {invoice.buyer}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(invoice.buyer, "buyer")}
                    className="self-end sm:self-center border border-border bg-card text-muted-foreground hover:text-foreground px-2 py-1 rounded flex items-center gap-1 min-h-[32px]"
                    aria-label="Copy buyer address"
                  >
                    {copyFailedKey === "buyer" ? (
                      <CircleAlert
                        className="w-3 h-3 text-destructive"
                        aria-hidden="true"
                      />
                    ) : copiedKey === "buyer" ? (
                      <Check
                        className="w-3 h-3 text-success"
                        aria-hidden="true"
                      />
                    ) : (
                      <Copy className="w-3 h-3" aria-hidden="true" />
                    )}
                    <span aria-hidden="true">
                      {copiedKey === "buyer" ? "COPIED" : "COPY"}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-5 space-y-4">
              <h2 className="text-xs font-bold font-mono text-foreground uppercase tracking-wider border-b border-border/40 pb-2 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-primary" />
                Escrow Security Vault
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
                <div className="bg-background border border-border/40 p-3 rounded">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase block">
                    {invoice.asset} Locked in Escrow
                  </span>
                  <span className="text-base font-bold text-info block mt-1">
                    {invoice.status === "Funded" ||
                    invoice.status === "Active" ||
                    invoice.status === "Confirmed"
                      ? formatAmount(invoice.faceValue, invoice.asset)
                      : `0.00 ${invoice.asset}`}
                  </span>
                </div>
                <div className="bg-background border border-border/40 p-3 rounded">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase block">
                    Escrow Condition
                  </span>
                  <span className="text-foreground block mt-1 font-bold">
                    {invoice.status === "Funded"
                      ? "Locked (Awaiting SME shipment proof)"
                      : invoice.status === "Active"
                        ? "Locked (Goods Shipped, Awaiting Buyer delivery confirmation)"
                        : invoice.status === "Confirmed"
                          ? "Active (Delivered, Awaiting Buyer repayment)"
                          : invoice.status === "Repaid"
                            ? "Released (Repayment completed)"
                            : "Unlocked / Empty"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="bg-card border border-border rounded-lg p-5 space-y-4">
              <h2 className="text-xs font-bold font-mono text-foreground uppercase tracking-wider border-b border-border/40 pb-2 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                Maturity Parameters
              </h2>
              <div className="space-y-4 font-mono text-xs">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="text-muted-foreground">Maturity Date:</span>
                  <span className="text-foreground font-bold">
                    {new Date(invoice.dueDate * 1000).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="text-muted-foreground">
                    Maturity Status:
                  </span>
                  <span
                    className={`font-bold ${isOverdue && invoice.status !== "Repaid" ? "text-warning" : "text-foreground"}`}
                  >
                    {isOverdue && invoice.status !== "Repaid"
                      ? "OVERDUE"
                      : `${daysRemaining} days remaining`}
                  </span>
                </div>
                <div className="flex flex-wrap justify-between gap-2 border-t border-border/20 pt-3">
                  <span className="text-muted-foreground">Discount Rate:</span>
                  <span className="text-primary font-bold">
                    {invoice.discountBps > 0
                      ? `${(invoice.discountBps / 100).toFixed(2)}%`
                      : "—"}
                  </span>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="text-muted-foreground">
                    Net Discount Fee:
                  </span>
                  <span className="text-foreground font-bold">
                    {formatAmount(
                      BigInt(invoice.faceValue) - BigInt(invoice.fundedAmount),
                      invoice.asset,
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-5 space-y-4">
              <h2 className="text-xs font-bold font-mono text-foreground uppercase tracking-wider border-b border-border/40 pb-2 flex items-center gap-1.5">
                <Share2 className="w-3.5 h-3.5 text-primary" />
                Share Invoice
              </h2>
              <div className="space-y-3 text-xs font-mono">
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  onClick={downloadPdf}
                  disabled={isExportingPdf}
                  aria-busy={isExportingPdf}
                >
                  <span>
                    {isExportingPdf ? "Generating PDF..." : "Download PDF"}
                  </span>
                  {isExportingPdf ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" />
                  ) : (
                    <FileDown className="w-3.5 h-3.5" />
                  )}
                </Button>
                {pdfError && (
                  <p
                    className="text-xs font-mono text-destructive"
                    role="alert"
                  >
                    {pdfError}
                  </p>
                )}
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() =>
                    copyToClipboard(invoiceUrl || window.location.href, "link")
                  }
                  disabled={!invoiceUrl}
                >
                  <span className="truncate">
                    {copiedKey === "link" ? "LINK COPIED" : "Copy Invoice Link"}
                  </span>
                  <Copy className="w-3.5 h-3.5 flex-shrink-0" />
                </Button>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <a
                    className="border border-border rounded px-2 py-2 text-center text-foreground transition-colors hover:border-primary hover:text-primary"
                    href={whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    WhatsApp
                  </a>
                  <a
                    className="border border-border rounded px-2 py-2 text-center text-foreground transition-colors hover:border-primary hover:text-primary"
                    href={telegramUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Telegram
                  </a>
                </div>
              </div>
            </div>

            {(canShip || canConfirm || canRepay || canDefault) && (
              <div className="bg-card border border-border rounded-lg p-5 space-y-3">
                <h2 className="text-xs font-bold font-mono text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" />
                  Available Action
                </h2>
                {canShip && (
                  <Button
                    className="w-full"
                    disabled={submitting}
                    onClick={ship}
                  >
                    MARK GOODS SHIPPED
                  </Button>
                )}
                {canConfirm && (
                  <Button
                    className="w-full"
                    disabled={submitting}
                    onClick={confirm}
                  >
                    CONFIRM DELIVERY
                  </Button>
                )}
                {canRepay && (
                  <Button
                    className="w-full"
                    disabled={submitting}
                    onClick={repay}
                  >
                    REPAY INVOICE
                  </Button>
                )}
                {canDefault && (
                  <Button
                    className="w-full"
                    disabled={submitting}
                    onClick={markDefault}
                  >
                    DEFAULT INVOICE
                  </Button>
                )}
                {error && (
                  <p
                    className="text-xs font-mono text-destructive"
                    role="alert"
                  >
                    {error}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <TransactionPending
        isOpen={showPending}
        txHash={pendingHash}
        statusText={pendingText}
        onClose={() => setShowPending(false)}
      />
    </PageLayout>
  );
}
