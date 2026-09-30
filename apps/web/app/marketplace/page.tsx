"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { PageLayout } from "@/components/shared/PageLayout";
import { InvoiceTable } from "@/components/invoice/InvoiceTable";
import { InvoiceCard } from "@/components/invoice/InvoiceCard";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { useInvoiceList } from "@/hooks/useInvoices";
import { usePool } from "@/hooks/usePool";
import { useWalletStore } from "@/store/wallet";
import { useProfile } from "@/hooks/useProfile";
import { Invoice } from "@/types";
import { formatAmount } from "@/lib/assets";
import { ShieldAlert } from "lucide-react";

// User-facing strings live in `messages/en.json` under the "Marketplace"
// namespace; see docs/developer-guide/i18n.md for the migration pattern.
export default function Marketplace() {
  const t = useTranslations("Marketplace");
  const connected = useWalletStore((s) => s.connected);
  const role = useWalletStore((s) => s.role);
  const { isVerified } = useProfile();
  const { stats, isStatsLoading } = usePool();
  const [statusFilter, setStatusFilter] = useState<string>("Listed");
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoiceLimit, setInvoiceLimit] = useState(20);

  // Filter States
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [maxDiscount, setMaxDiscount] = useState("500"); // 500 bps max

  const { invoices, isLoading, total, totalPages } = useInvoiceList({
    status: statusFilter === "ALL" ? undefined : statusFilter,
    page: invoicePage,
    limit: invoiceLimit,
  });

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const handleSelectInvoice = useCallback(
    (invoice: Invoice) => setSelectedInvoice(invoice),
    [],
  );

  useEffect(() => {
    setInvoicePage(1);
    setSelectedInvoice(null);
  }, [statusFilter, minAmount, maxAmount, maxDiscount]);

  // Filter and Sort Invoices
  const filteredAndSortedInvoices = useMemo(() => {
    let result = [...invoices];

    // Filter by Min Amount
    if (minAmount) {
      const minStroops = BigInt(parseFloat(minAmount) * 10_000_000);
      result = result.filter((inv) => inv.faceValue >= minStroops);
    }

    // Filter by Max Amount
    if (maxAmount) {
      const maxStroops = BigInt(parseFloat(maxAmount) * 10_000_000);
      result = result.filter((inv) => inv.faceValue <= maxStroops);
    }

    // Filter by Max Discount Rate (bps)
    const discBps = parseInt(maxDiscount, 10);
    if (!isNaN(discBps)) {
      result = result.filter((inv) => inv.discountBps <= discBps);
    }

    // Sort by Face Value Descending by default
    return result.sort((a, b) => {
      if (b.faceValue > a.faceValue) return 1;
      if (b.faceValue < a.faceValue) return -1;
      return 0;
    });
  }, [invoices, minAmount, maxAmount, maxDiscount]);

  const handlePageChange = (page: number) => {
    setInvoicePage(page);
    setSelectedInvoice(null);
  };

  const handleLimitChange = (limit: number) => {
    setInvoiceLimit(limit);
    setInvoicePage(1);
    setSelectedInvoice(null);
  };

  // Calculate funded amount preview (face value - discount fee)
  const calculateFundingValue = (faceValue: bigint, discountBps: number) => {
    const value = Number(faceValue);
    const fee = value * (discountBps / 10000);
    return BigInt(Math.floor(value - fee));
  };

  return (
    <PageLayout>
      <div className="space-y-8 py-4">
        {/* Header */}
        <div className="border-b border-border/40 pb-5">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-xl font-bold font-mono tracking-wider uppercase text-white">
                {t("header.title")}
              </h1>
              <p className="text-slate-500 text-xs font-mono mt-1">
                {t("header.description")}
              </p>
            </div>

            {/* Top Available Liquidity indicator */}
            <div className="bg-[#0d131a] border border-border rounded-lg px-4 py-2 text-right font-mono">
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">
                {t("header.liquidityLabel")}
              </span>
              <span className="text-sm font-bold text-primary block mt-0.5">
                {isStatsLoading
                  ? t("syncing")
                  : formatAmount(stats?.availableLiquidity)}
              </span>
            </div>
          </div>
        </div>

        {/* Warning Banner for Unverified Profiles */}
        {connected && !isVerified && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-start gap-3 font-mono text-xs text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.02)]">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold uppercase">
                {t("verificationBanner.title")}
              </span>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                {t.rich("verificationBanner.body", {
                  link: (chunks) => (
                    <Link
                      href="/profile"
                      className="text-primary hover:underline font-bold"
                    >
                      {chunks}
                    </Link>
                  ),
                })}
              </p>
            </div>
          </div>
        )}

        {/* Filter bar */}
        <div className="bg-[#0d131a] border border-border rounded-lg p-4 grid grid-cols-1 md:grid-cols-4 gap-4 font-mono text-xs items-end">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 font-bold uppercase">
              {t("filters.status.label")}
            </span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setSelectedInvoice(null);
              }}
              className="w-full bg-[#080c10] border border-border rounded px-3 py-1.5 text-white focus:outline-none focus:border-primary cursor-pointer"
            >
              <option value="ALL">{t("filters.status.options.all")}</option>
              <option value="Created">
                {t("filters.status.options.created")}
              </option>
              <option value="Listed">
                {t("filters.status.options.listed")}
              </option>
              <option value="Funded">
                {t("filters.status.options.funded")}
              </option>
              <option value="Active">
                {t("filters.status.options.active")}
              </option>
              <option value="Confirmed">
                {t("filters.status.options.confirmed")}
              </option>
              <option value="Repaid">
                {t("filters.status.options.repaid")}
              </option>
              <option value="Defaulted">
                {t("filters.status.options.defaulted")}
              </option>
            </select>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="marketplace-min-value"
              className="text-[10px] text-slate-500 font-bold uppercase"
            >
              {t("filters.minValue.label")}
            </label>
            <input
              id="marketplace-min-value"
              type="number"
              placeholder={t("filters.minValue.placeholder")}
              className="w-full bg-[#080c10] border border-border rounded px-3 py-1.5 text-white focus:outline-none focus:border-primary"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="marketplace-max-value"
              className="text-[10px] text-slate-500 font-bold uppercase"
            >
              {t("filters.maxValue.label")}
            </label>
            <input
              id="marketplace-max-value"
              type="number"
              placeholder={t("filters.maxValue.placeholder")}
              className="w-full bg-[#080c10] border border-border rounded px-3 py-1.5 text-white focus:outline-none focus:border-primary"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-500 font-bold uppercase">
                {t("filters.maxDiscount.label")}
              </span>
              <span className="text-primary font-bold">
                {(parseInt(maxDiscount) / 100).toFixed(1)}%
              </span>
            </div>
            <input
              type="range"
              min="50"
              max="500"
              step="50"
              className="w-full accent-primary bg-slate-900 h-1.5 rounded"
              value={maxDiscount}
              onChange={(e) => setMaxDiscount(e.target.value)}
              aria-label={t("filters.maxDiscount.ariaLabel")}
              aria-valuenow={parseInt(maxDiscount)}
              aria-valuemin={50}
              aria-valuemax={500}
            />
          </div>
        </div>

        {/* Marketplace Contents */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Marketplace List (Left) */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-bold font-mono tracking-wider uppercase text-white">
                {t("invoices.title", {
                  count: filteredAndSortedInvoices.length,
                })}
              </h2>
              {isLoading && (
                <span className="text-xs text-primary animate-pulse font-mono uppercase">
                  {t("syncing")}
                </span>
              )}
            </div>

            {/* Invoices Table */}
            <ErrorBoundary context="InvoiceList">
              <InvoiceTable
                invoices={filteredAndSortedInvoices}
                onSelectInvoice={handleSelectInvoice}
                activeId={selectedInvoice?.id}
                role={role}
                emptyStateTitle={t("invoices.emptyState.title")}
                emptyStateDescription={t("invoices.emptyState.description")}
                emptyStateAction={{
                  label: t("invoices.emptyState.action"),
                  onClick: () => {
                    setStatusFilter("Listed");
                    setMinAmount("");
                    setMaxAmount("");
                    setMaxDiscount("500");
                    setSelectedInvoice(null);
                    setInvoicePage(1);
                  },
                }}
                pagination={{
                  page: invoicePage,
                  limit: invoiceLimit,
                  total,
                  totalPages,
                  onPageChange: handlePageChange,
                  onLimitChange: handleLimitChange,
                }}
              />
            </ErrorBoundary>
          </div>

          {/* Console Management Center (Right) */}
          <div className="lg:col-span-4 space-y-4">
            <h2 className="text-sm font-bold font-mono tracking-wider uppercase text-white">
              {t("console.title")}
            </h2>

            <ErrorBoundary context="ManagementCenter">
              {selectedInvoice ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-[10px] font-mono">
                    <span className="text-slate-500 uppercase">
                      {t.rich("console.role", {
                        role: connected ? role : t("console.publicView"),
                        strong: (chunks) => (
                          <strong className="text-primary uppercase">
                            {chunks}
                          </strong>
                        ),
                      })}
                    </span>
                    <button
                      onClick={() => setSelectedInvoice(null)}
                      className="text-primary hover:underline uppercase font-bold"
                    >
                      {t("console.clear")}
                    </button>
                  </div>

                  {/* LP Action: Fund from Pool Preview */}
                  {selectedInvoice.status === "Listed" &&
                    role === "lp" &&
                    connected && (
                      <div className="bg-[#0d131a] border border-primary/20 rounded p-4 text-xs font-mono space-y-2">
                        <span className="text-primary font-bold block uppercase text-[10px] tracking-wider">
                          {t("console.fundingPreview.title")}
                        </span>
                        <div className="flex justify-between">
                          <span>{t("console.fundingPreview.faceValue")}</span>
                          <span>
                            {formatAmount(
                              selectedInvoice.faceValue,
                              selectedInvoice.asset,
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between text-primary font-bold">
                          <span>
                            {t("console.fundingPreview.fundedCost", {
                              bps: selectedInvoice.discountBps,
                            })}
                          </span>
                          <span>
                            {formatAmount(
                              calculateFundingValue(
                                selectedInvoice.faceValue,
                                selectedInvoice.discountBps,
                              ),
                              selectedInvoice.asset,
                            )}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 pt-1 leading-normal border-t border-border/20 mt-1">
                          {t("console.fundingPreview.note")}
                        </div>
                      </div>
                    )}

                  <InvoiceCard
                    invoice={selectedInvoice}
                    role={connected ? role : undefined}
                    isSelected
                  />
                </div>
              ) : (
                <div className="bg-card border border-dashed border-border rounded-lg p-6 text-center text-slate-500 font-mono text-[10px] py-20 uppercase tracking-wider">
                  <p className="mb-2 font-bold text-slate-400">
                    {t("console.emptyState.title")}
                  </p>
                  <p className="normal-case text-slate-500 leading-relaxed max-w-[200px] mx-auto">
                    {t("console.emptyState.description")}
                  </p>
                </div>
              )}
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
