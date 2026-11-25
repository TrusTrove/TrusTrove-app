"use client";

import React, { useState } from "react";
import { AmountInput } from "./AmountInput";
import { TrendingUp, PiggyBank, Landmark } from "lucide-react";

const SAVINGS_APY = 5.0;
const TBILLS_APY = 4.5;
const AVG_DISCOUNT_RATE = 2.0;
const AVG_MATURITY_DAYS = 60;

// Strip thousands separators before parsing: the AmountInput placeholder
// advertises comma-grouped values ("10,000"), but parseFloat("10,000")
// returns 10, silently shrinking deposits by up to 1000x (#1104).
export function parseDeposit(raw: string): number {
  return parseFloat(raw.replace(/,/g, "")) || 0;
}

export function LpYieldCalculator() {
  const [deposit, setDeposit] = useState("10000");
  const [utilization, setUtilization] = useState(75);

  const parsedDeposit = parseDeposit(deposit);

  const annualYieldPct =
    (utilization / 100) *
    (AVG_DISCOUNT_RATE / 100) *
    (365 / AVG_MATURITY_DAYS) *
    100;

  const monthlyEarnings = (parsedDeposit * (annualYieldPct / 100)) / 12;

  const maxApy = Math.max(annualYieldPct, SAVINGS_APY, TBILLS_APY);
  const trustroveWidth = maxApy > 0 ? (annualYieldPct / maxApy) * 100 : 0;
  const savingsWidth = (SAVINGS_APY / maxApy) * 100;
  const tbillWidth = (TBILLS_APY / maxApy) * 100;

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-5 shadow-[0_0_30px_rgba(0,212,170,0.02)]">
      <h3 className="text-xs font-bold font-mono text-foreground uppercase tracking-wider border-b border-border/40 pb-2 flex items-center justify-between">
        <span>I&apos;m an LP</span>
        <span className="text-primary text-[10px]">YIELD CALC</span>
      </h3>

      <div className="space-y-4">
        <AmountInput
          value={deposit}
          onChange={setDeposit}
          asset="USDC"
          label="Deposit Amount (USDC)"
          placeholder="10,000"
        />

        <div className="space-y-2">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-muted-foreground">Pool Utilization</span>
            <span className="text-primary font-bold">{utilization}%</span>
          </div>
          <input
            id="lp-yield-utilization"
            type="range"
            min="10"
            max="100"
            step="1"
            value={utilization}
            onChange={(e) => setUtilization(parseInt(e.target.value))}
            className="w-full accent-primary bg-border h-1.5 rounded"
            aria-label="Pool Utilization"
            aria-valuenow={utilization}
            aria-valuemin={10}
            aria-valuemax={100}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
            <span>10%</span>
            <span>100%</span>
          </div>
        </div>
      </div>

      <div className="bg-background border border-border/60 rounded p-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            Estimated Annual Yield
          </span>
          <span className="text-2xl font-extrabold font-mono text-emerald-700 dark:text-emerald-400">
            {annualYieldPct.toFixed(2)}%
          </span>
        </div>
        <div className="flex justify-between items-center border-t border-border/25 pt-2">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            Monthly Earnings
          </span>
          <span className="text-sm font-bold font-mono text-foreground">
            {monthlyEarnings.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            USDC
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <span className="text-[10px] font-bold font-mono text-muted-foreground uppercase tracking-wider block">
          Yield Comparison
        </span>

        <div className="space-y-2.5">
          <div>
            <div className="flex justify-between text-[10px] font-mono mb-1">
              <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                <TrendingUp className="w-3 h-3" />
                TrusTrove LP
              </span>
              <span className="text-foreground font-bold">
                {annualYieldPct.toFixed(2)}%
              </span>
            </div>
            <div className="w-full h-3 bg-border rounded-sm overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-sm transition-all duration-300"
                style={{ width: `${Math.min(trustroveWidth, 100)}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[10px] font-mono mb-1">
              <span className="flex items-center gap-1 text-blue-700 dark:text-blue-400">
                <PiggyBank className="w-3 h-3" />
                Savings Account
              </span>
              <span className="text-foreground font-bold">
                {SAVINGS_APY.toFixed(2)}%
              </span>
            </div>
            <div className="w-full h-3 bg-border rounded-sm overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-sm transition-all duration-300"
                style={{ width: `${savingsWidth}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[10px] font-mono mb-1">
              <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
                <Landmark className="w-3 h-3" />
                T-Bills
              </span>
              <span className="text-foreground font-bold">
                {TBILLS_APY.toFixed(2)}%
              </span>
            </div>
            <div className="w-full h-3 bg-border rounded-sm overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-sm transition-all duration-300"
                style={{ width: `${tbillWidth}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-border/40 pt-3">
        <span className="text-[10px] font-mono text-muted-foreground block leading-relaxed">
          Yield depends on pool utilization and invoice repayment rate. Smart
          contract risk exists.
        </span>
      </div>
    </div>
  );
}
