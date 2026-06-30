"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageLayout } from "@/components/shared/PageLayout";
import { useInvoice, useInvoices } from "@/hooks/useInvoices";
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
  ArrowLeft,
  Lock,
  Users,
  Activity,
  TrendingUp,
  Share2,
} from "lucide-react";
import { formatAmount } from "@/lib/assets";

interface InvoiceDetailClientProps {
  invoiceId: string;
}

export default function InvoiceDetailClient({
  invoiceId,
}: InvoiceDetailClientProps) {
  const router = useRouter();
  const { address, connected, role } = useWalletStore();

  const { invoice, isLoading, refetch } = useInvoice(invoiceId);
  const { shipInvoice, confirmDelivery, repayInvoice, defaultInvoice } =
    useInvoices();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [copiedId, setCopiedId] = useState(false);
  const [copiedIssuer, setCopiedIssuer] = useState(false);
  const [copiedBuyer, setCopiedBuyer] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [invoiceUrl, setInvoiceUrl] = useState("");

  const [showPending, setShowPending] = useState(false);
  const [pendingHash, setPendingHash] = useState<string | null>(null);
  const [pendingText, setPendingText] = useState("Waiting for confirmation...");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setInvoiceUrl(window.location.href);
    }
  }, []);

  const formatAddress = (addr: string) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const copyToClipboard = async (
    text: string,
    type: "id" | "issuer" | "buyer" | "link",
  ) => {
    await navigator.clipboard.writeText(text);
    switch (type) {
      case "id":
        setCopiedId(true);
        setTimeout(() => setCopiedId(false), 2000);
        break;
      case "issuer":
        setCopiedIssuer(true);
        setTimeout(() => setCopiedIssuer(false), 2000);
        break;
      case "buyer":
        setCopiedBuyer(true);
        setTimeout(() => setCopiedBuyer(false), 2000);
        break;
      case "link":
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
        break;
    }
  };

  const handleAction = async (
    actionFn: () => Promise<any>,
    text: string,
    errorMsg: string,
  ) => {
    setSubmitting(true);
    setError(null);
    setPendingText(text);
    setPendingHash(null);
    setShowPending(true);

    try {
      const res = await actionFn();
      if (typeof res === "string") {
        setPendingHash(res);
      }
      await refetch();
    } catch (err: any) {
      setError(err.message || errorMsg);
      setShowPending(false);
    } finally {
      setSubmitting(false);
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
        <div className="flex flex-col items-center justify-center py-20 min-h-[50vh] font-mono text-xs text-primary animate-pulse uppercase">
          Fetching invoice state from ledger...
        </div>
      </PageLayout>
    );
  }

  if (!invoice) {
    return (
      <PageLayout>
        <div className="flex flex-col items-center justify-center py-20 min-h-[50vh] text-center max-w-sm mx-auto space-y-4">
          <ShieldAlert className="w-12 h-12 text-amber-500" />
          <h1 className="text-md font-bold font-mono text-white uppercase">
            Ledger entry not found
          </h1>
          <p className="text-slate-500 text-xs font-mono">
            The invoice ID: {invoiceId} was not found on-chain. Please verify
            the address.
          </p>
          <Button
            className="border border-border text-slate-300 font-mono text-xs uppercase px-4 py-2 hover:bg-slate-900"
            onClick={() => router.push("/marketplace")}
          >
            Return to Marketplace
          </Button>
        </div>
      </PageLayout>
    );
  }

  const nowSecs = Math.floor(Date.now() / 1000);
  const secondsRemaining = Number(invoice.dueDate) - nowSecs;
  const daysRemaining = Math.ceil(secondsRemaining / (24 * 3600));
  const isOverdue = secondsRemaining < 0;

  return (
    <PageLayout>
      <div className="space-y-6 py-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-xs font-bold font-mono text-slate-500 hover:text-white uppercase transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <span className="text-slate-600 font-mono text-xs">/</span>
          <span className="text-slate-400 font-mono text-xs font-bold">
            Ledger Details
          </span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <h1 className="text-md font-bold font-mono text-white">
                INVOICE AUDIT LEDGER
              </h1>
              <InvoiceStatus status={invoice.status} />
            </div>
            <div className="flex items-center gap-1.5 font-mono text-xs text-slate-500">
              <span>
                HASH: <strong className="text-slate-400">{invoice.id}</strong>
              </span>
              <button
                onClick={() => copyToClipboard(invoice.id, "id")}
                className="text-slate-600 hover:text-primary transition-colors"
                aria-label="Copy invoice ID"
              >
                {copiedId ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          <div className="bg-[#0d131a] border border-border rounded px-4 py-2 font-mono text-right">
            <span className="text-[10px] text-slate-500 font-bold uppercase block">
              Face Value Obligations
            </span>
            <span className="text-lg font-bold text-white block mt-0.5">
              {formatAmount(invoice.faceValue)}
            </span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <h3 className="text-xs font-bold font-mono text-white uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-primary" />
            Soroban Transaction Progress
          </h3>
          <InvoiceStatusTimeline invoice={invoice} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-card border border-border rounded-lg p-5 space-y-4">
              <h3 className="text-xs font-bold font-mono text-white uppercase tracking-wider border-b border-border/40 pb-2 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-primary" />
                Obligation Parties
              </h3>

              <div className="space-y-4 font-mono text-xs">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 p-2.5 bg-[#080c10]/40 rounded border border-border/30">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">
                      SME Issuer (Vendor)
                    </span>
                    <span className="text-slate-300 break-all select-all font-bold">
                      {invoice.issuer}
                    </span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(invoice.issuer, "issuer")}
                    className="self-end sm:self-center border border-border bg-[#0d131a] text-slate-400 hover:text-white px-2 py-1 rounded flex items-center gap-1"
                  >
                    {copiedIssuer ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiedIssuer ? "COPIED" : "COPY"}</span>
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 p-2.5 bg-[#080c10]/40 rounded border border-border/30">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">
                      Buyer Party (Debtor)
                    </span>
                    <span className="text-slate-300 break-all select-all font-bold">
                      {invoice.buyer}
                    </span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(invoice.buyer, "buyer")}
                    className="self-end sm:self-center border border-border bg-[#0d131a] text-slate-400 hover:text-white px-2 py-1 rounded flex items-center gap-1"
                  >
                    {copiedBuyer ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiedBuyer ? "COPIED" : "COPY"}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-5 space-y-4">
              <h3 className="text-xs font-bold font-mono text-white uppercase tracking-wider border-b border-border/40 pb-2 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-primary" />
                Escrow Security Vault
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
                <div className="bg-[#080c10] border border-border/40 p-3 rounded">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">
                    {invoice.asset} Locked in Escrow
                  </span>
                  <span className="text-md font-bold text-sky-400 block mt-1">
                    {invoice.status === "Funded" ||
                    invoice.status === "Active" ||
                    invoice.status === "Confirmed"
                      ? formatAmount(invoice.faceValue, invoice.asset)
                      : `0.00 ${invoice.asset}`}
                  </span>
                </div>
                <div className="bg-[#080c10] border border-border/40 p-3 rounded">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">
                    Escrow Condition
                  </span>
                  <span className="text-slate-300 block mt-1 font-bold">
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
            <div className="bg-[#0d131a] border border-border rounded-lg p-5 space-y-4">
              <h3 className="text-xs font-bold font-mono text-white uppercase tracking-wider border-b border-border/40 pb-2 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                Maturity Parameters
              </h3>

              <div className="space-y-4 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Maturity Date:</span>
                  <span className="text-slate-300 font-bold">
                    {new Date(invoice.dueDate * 1000).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">Maturity Status:</span>
                  <span
                    className={`font-bold ${isOverdue && invoice.status !== "Repaid" ? "text-amber-500" : "text-slate-300"}`}
                  >
                    {isOverdue && invoice.status !== "Repaid"
                      ? "OVERDUE"
                      : `${daysRemaining} days remaining`}
                  </span>
                </div>

                <div className="flex justify-between border-t border-border/20 pt-3">
                  <span className="text-slate-500">Discount Rate:</span>
                  <span className="text-primary font-bold">
                    {invoice.discountBps > 0
                      ? `${(invoice.discountBps / 100).toFixed(2)}%`
                      : "—"}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">Net Discount Fee:</span>
                  <span className="text-slate-300 font-bold">
                    {formatAmount(invoice.faceValue - invoice.fundedAmount)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-[#0d131a] border border-border rounded-lg p-5 space-y-4">
              <h3 className="text-xs font-bold font-mono text-white uppercase tracking-wider border-b border-border/40 pb-2 flex items-center gap-1.5">
                <Share2 className="w-3.5 h-3.5 text-primary" />
                Share Invoice
              </h3>
              <div className="space-y-3 text-xs font-mono">
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    onClick={() =>
                      copyToClipboard(
                        invoiceUrl || window.location.href,
                        "link",
                      )
                    }
                    disabled={!invoiceUrl}
                  >
                    <span>
                      {copiedLink ? "LINK COPIED" : "Copy Invoice Link"}
                    </span>
                    <span className="text-slate-400 text-[10px]">
                      {invoiceUrl ? invoiceUrl : ""}
                    </span>
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-md border border-border bg-[#111827] px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-slate-200 hover:bg-slate-800"
                    >
                      WhatsApp
                    </a>
                    <a
                      href={telegramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-md border border-border bg-[#111827] px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-slate-200 hover:bg-slate-800"
                    >
                      Telegram
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {connected && (
              <div className="bg-[#0d131a] border border-border rounded-lg p-5 space-y-4">
                <h3 className="text-xs font-bold font-mono text-white uppercase tracking-wider border-b border-border/40 pb-2 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" />
                  Contract Triggers
                </h3>

                {error && (
                  <div className="p-3 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-mono leading-normal">
                    <ShieldAlert className="w-3.5 h-3.5 inline mr-1" />
                    {error}
                  </div>
                )}

                <div className="space-y-3">
                  {invoice.status === "Funded" && role === "issuer" && (
                    <Button
                      className="w-full bg-primary hover:bg-primary-hover text-black font-bold uppercase text-xs tracking-wider py-2.5 rounded"
                      onClick={() =>
                        handleAction(
                          () => shipInvoice({ invoiceId: invoice.id }),
                          "Submitting shipment confirmation...",
                          "Failed to mark as shipped",
                        )
                      }
                      disabled={submitting}
                    >
                      MARK GOODS SHIPPED
                    </Button>
                  )}

                  {invoice.status === "Active" &&
                    role === "buyer" &&
                    !invoice.buyerConfirmed && (
                      <Button
                        className="w-full bg-primary hover:bg-primary-hover text-black font-bold uppercase text-xs tracking-wider py-2.5 rounded"
                        onClick={() =>
                          handleAction(
                            () => confirmDelivery({ invoiceId: invoice.id }),
                            "Submitting delivery confirmation...",
                            "Failed to confirm delivery",
                          )
                        }
                        disabled={submitting}
                      >
                        CONFIRM DELIVERY
                      </Button>
                    )}

                  {invoice.status === "Confirmed" && role === "buyer" && (
                    <Button
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase text-xs tracking-wider py-2.5 rounded shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                      onClick={() =>
                        handleAction(
                          () => repayInvoice({ invoiceId: invoice.id }),
                          "Submitting USDC repayment...",
                          "Failed to repay invoice",
                        )
                      }
                      disabled={submitting}
                    >
                      REPAY {formatAmount(invoice.faceValue)}
                    </Button>
                  )}

                  {invoice.status === "Active" && isOverdue && (
                    <Button
                      className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold uppercase text-xs tracking-wider py-2.5 rounded"
                      onClick={() =>
                        handleAction(
                          () => defaultInvoice({ invoiceId: invoice.id }),
                          "Triggering default on-chain...",
                          "Failed to trigger default",
                        )
                      }
                      disabled={submitting}
                    >
                      TRIGGER DEFAULT (OVERDUE)
                    </Button>
                  )}

                  <div className="text-[10px] font-mono text-slate-500 text-center uppercase tracking-wider py-2 leading-relaxed">
                    Connected wallet: {formatAddress(address!)} <br />
                    Consoling role:{" "}
                    <span className="text-primary font-bold">
                      {role.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <TransactionPending
        isOpen={showPending}
        txHash={pendingHash}
        statusText={pendingText}
        onClose={pendingHash ? () => setShowPending(false) : undefined}
      />
    </PageLayout>
  );
}
