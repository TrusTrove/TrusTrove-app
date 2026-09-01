"use client";

import React, { useState } from "react";
import { TrendingUp } from "lucide-react";
import { AnimatedValue } from "./DiscountCalculator";

export function LpCalculator() {
  const [lpDeposit, setLpDeposit] = useState<number>(10000);
  const [lpUtilization, setLpUtilization] = useState<number>(80);
  const [lpAvgDiscount, setLpAvgDiscount] = useState<number>(2.0);
  const [lpAvgMaturity, setLpAvgMaturity] = useState<number>(60);

  const lpProjectedApy =
    (lpUtilization / 100) * (lpAvgDiscount / 100) * (365 / lpAvgMaturity) * 100;
  const lpAnnualEarnings = lpDeposit * (lpProjectedApy / 100);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* LP Inputs */}
      <div className="space-y-6">
        <h3 className="text-xs font-bold font-mono text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-primary" />
          LP Yield projection inputs
        </h3>

        {/* LP Deposit */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-slate-400">Total USDC Deposit</span>
            <span className="text-primary font-bold">
              {lpDeposit.toLocaleString()} USDC
            </span>
          </div>
          <input
            id="discount-lp-deposit"
            type="range"
            min="500"
            max="100000"
            step="500"
            value={lpDeposit}
            onChange={(e) => setLpDeposit(parseInt(e.target.value))}
            className="w-full accent-primary bg-slate-900 h-1.5 rounded"
            aria-label="Total USDC Deposit"
            aria-valuenow={lpDeposit}
            aria-valuemin={500}
            aria-valuemax={100000}
          />
          <div className="flex justify-between text-[10px] text-slate-600 font-mono">
            <span>$500 USDC</span>
            <span>$100K USDC</span>
          </div>
        </div>

        {/* LP Utilization */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-slate-400">Target Pool Utilization</span>
            <span className="text-primary font-bold">{lpUtilization}%</span>
          </div>
          <input
            id="discount-lp-utilization"
            type="range"
            min="10"
            max="100"
            step="5"
            value={lpUtilization}
            onChange={(e) => setLpUtilization(parseInt(e.target.value))}
            className="w-full accent-primary bg-slate-900 h-1.5 rounded"
            aria-label="Target Pool Utilization"
            aria-valuenow={lpUtilization}
            aria-valuemin={10}
            aria-valuemax={100}
          />
          <div className="flex justify-between text-[10px] text-slate-600 font-mono">
            <span>10% (Low)</span>
            <span>100% (Max)</span>
          </div>
        </div>

        {/* LP Avg Discount */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-slate-400">Avg Invoice Discount Bps</span>
            <span className="text-primary font-bold">
              {lpAvgDiscount.toFixed(1)}% ({Math.round(lpAvgDiscount * 100)}{" "}
              bps)
            </span>
          </div>
          <input
            id="discount-lp-avg-discount"
            type="range"
            min="0.5"
            max="5.0"
            step="0.1"
            value={lpAvgDiscount}
            onChange={(e) => setLpAvgDiscount(parseFloat(e.target.value))}
            className="w-full accent-primary bg-slate-900 h-1.5 rounded"
            aria-label="Avg Invoice Discount Bps"
            aria-valuenow={lpAvgDiscount}
            aria-valuemin={0.5}
            aria-valuemax={5.0}
          />
          <div className="flex justify-between text-[10px] text-slate-600 font-mono">
            <span>0.5%</span>
            <span>5.0%</span>
          </div>
        </div>

        {/* LP Avg Days to maturity */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-slate-400">Avg Days to Maturity</span>
            <span className="text-primary font-bold">{lpAvgMaturity} Days</span>
          </div>
          <input
            id="discount-lp-avg-maturity"
            type="range"
            min="15"
            max="90"
            step="5"
            value={lpAvgMaturity}
            onChange={(e) => setLpAvgMaturity(parseInt(e.target.value))}
            className="w-full accent-primary bg-slate-900 h-1.5 rounded"
            aria-label="Avg Days to Maturity"
            aria-valuenow={lpAvgMaturity}
            aria-valuemin={15}
            aria-valuemax={90}
          />
          <div className="flex justify-between text-[10px] text-slate-600 font-mono">
            <span>15 Days</span>
            <span>90 Days</span>
          </div>
        </div>
      </div>

      {/* LP Output Card */}
      <div className="bg-[#080c10] border border-primary/20 p-5 rounded-lg flex flex-col justify-between shadow-[inset_0_0_15px_rgba(0,212,170,0.02)]">
        <div>
          <div className="text-[10px] font-bold font-mono text-primary uppercase tracking-wider mb-4">
            Projected Yield Metrics
          </div>
          <div className="space-y-5">
            <div>
              <span className="text-[10px] text-slate-500 font-mono block">
                Estimated APR:
              </span>
              <span className="text-3xl font-extrabold text-emerald-400 font-mono">
                {lpProjectedApy.toFixed(2)}%
              </span>
              <span className="text-[9px] text-slate-600 block mt-1 leading-normal font-mono">
                Formula: Utilization ({lpUtilization}%) × Avg Discount (
                {lpAvgDiscount}%) × (365 / Avg Maturity ({lpAvgMaturity}d))
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 font-mono block">
                Projected Annual Yield:
              </span>
              <span className="text-lg font-bold text-slate-200 font-mono">
                <AnimatedValue value={lpAnnualEarnings} suffix=" USDC" />
              </span>
              <span className="text-[9px] text-slate-500 block mt-1 font-mono">
                Earnings generated annually based on{" "}
                {lpDeposit.toLocaleString()} USDC principal.
              </span>
            </div>
          </div>
        </div>

        <div className="bg-slate-950 p-3 border border-border/40 rounded text-[10px] font-mono text-slate-500 mt-6 leading-relaxed">
          <span className="text-primary font-bold block mb-1">
            PROTCOL YIELD MECHANIC
          </span>
          USDC is never idle. Invoices listed by SMEs are funded automatically
          by the pool contract using liquid deposits, allocating discount fees
          to LPs proportionally.
        </div>
      </div>
    </div>
  );
}
