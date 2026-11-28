"use client";

import React from "react";
import { Invoice } from "@/types";
import { VerificationBadge, VerificationState } from "./VerificationBadge";
import { formatAmount } from "../../lib/assets";
import {
  Shield,
  Calendar,
  Percent,
  Landmark,
  DollarSign,
  AlertCircle,
} from "lucide-react";

interface InvoiceRiskSummaryProps {
  invoice: Invoice;
  poolCapacity?: bigint;
  fundingAmount: bigint;
}

export function InvoiceRiskSummary({
  invoice,
  poolCapacity,
  fundingAmount,
}: InvoiceRiskSummaryProps) {
  const verificationState: VerificationState =
    invoice.riskScoreBps != null ? "verified" : "unverified";

  const nowSecs = Math.floor(Date.now() / 1000);
  const secondsRemaining = Number(invoice.dueDate) - nowSecs;
  const daysRemaining = Math.max(0, Math.ceil(secondsRemaining / (24 * 3600)));
  const formattedMaturity = new Date(
    Number(invoice.dueDate) * 1000,
  ).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const isOverCapacity =
    poolCapacity !== undefined && fundingAmount > poolCapacity;

  return (
    <div
      className="bg-card border border-border rounded-lg p-4 space-y-4 font-mono text-xs"
      role="region"
      aria-label="Pre-signing Risk Summary"
    >
      <div className="flex items-center justify-between border-b border-border/40 pb-3">
        <span className="text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 font-bold">
          <Shield className="w-4 h-4 text-primary" aria-hidden="true" />
          Buyer Verification
        </span>
        <VerificationBadge
          state={verificationState}
          riskScoreBps={invoice.riskScoreBps}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider block flex items-center gap-1">
            <Calendar className="w-3 h-3" aria-hidden="true" />
            Maturity
          </span>
          <span className="text-foreground font-bold">
            {formattedMaturity} ({daysRemaining}d)
          </span>
        </div>

        <div>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider block flex items-center gap-1">
            <Percent className="w-3 h-3" aria-hidden="true" />
            Discount
          </span>
          <span className="text-primary font-bold">
            {invoice.discountBps > 0
              ? `${(invoice.discountBps / 100).toFixed(2)}%`
              : "—"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 border-t border-border/40 pt-3">
        <div>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider block flex items-center gap-1">
            <Landmark className="w-3 h-3" aria-hidden="true" />
            Pool Capacity
          </span>
          <span className="text-foreground font-bold">
            {poolCapacity !== undefined
              ? formatAmount(poolCapacity, invoice.asset)
              : "—"}
          </span>
        </div>

        <div>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider block flex items-center gap-1">
            <DollarSign className="w-3 h-3" aria-hidden="true" />
            Funding Amount
          </span>
          <span
            className={`font-bold ${
              isOverCapacity ? "text-rose-400" : "text-foreground"
            }`}
          >
            {formatAmount(fundingAmount, invoice.asset)}
          </span>
        </div>
      </div>

      {isOverCapacity && (
        <div
          className="flex items-center gap-2 p-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded text-[11px]"
          role="alert"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Funding amount exceeds available pool capacity.</span>
        </div>
      )}
    </div>
  );
}
