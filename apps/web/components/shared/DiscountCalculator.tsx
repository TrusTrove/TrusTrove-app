"use client";

import React, { useState, useEffect, useRef } from "react";
import { Sparkles, TrendingUp } from "lucide-react";

function AnimatedValue({
  value,
  suffix = "",
  prefix = "",
}: {
  value: number;
  suffix?: string;
  prefix?: string;
}) {
  const [displayValue, setDisplayValue] = useState(value);
  const startRef = useRef(value);
  const frameRef = useRef<number | null>(null);

  startRef.current = displayValue;

  useEffect(() => {
    const start = startRef.current;
    const end = value;
    if (start === end) return;

    const duration = 400;
    const startTime = performance.now();

    const updateNumber = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = progress * (2 - progress);
      const current = start + (end - start) * easeProgress;

      setDisplayValue(current);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(updateNumber);
      }
    };

    frameRef.current = requestAnimationFrame(updateNumber);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [value]);

  return (
    <span className="font-mono">
      {prefix}
      {displayValue.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })}
      {suffix}
    </span>
  );
}

export function DiscountCalculator() {
  const [activeTab, setActiveTab] = useState<"sme" | "lp">("sme");

  // SME Tab State
  const [faceValue, setFaceValue] = useState<number>(50000);
  const [paymentTerms, setPaymentTerms] = useState<number>(60);
  const [discountRate, setDiscountRate] = useState<number>(2.0); // as percentage

  // LP Tab State
  const [lpDeposit, setLpDeposit] = useState<number>(10000);
  const [lpUtilization, setLpUtilization] = useState<number>(80); // as percentage
  const [lpAvgDiscount, setLpAvgDiscount] = useState<number>(2.0); // as percentage
  const [lpAvgMaturity, setLpAvgMaturity] = useState<number>(60); // average days to maturity

  // Calculations
  const discountPaid = faceValue * (discountRate / 100);
  const fundedAmount = faceValue - discountPaid;

  // LP Projected Yield: APY ≈ utilization_rate × avg_discount × (365 / avg_days_to_maturity)
  const lpProjectedApy =
    (lpUtilization / 100) * (lpAvgDiscount / 100) * (365 / lpAvgMaturity) * 100;
  const lpAnnualEarnings = lpDeposit * (lpProjectedApy / 100);

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-border bg-[#080c10]/60">
        <button
          onClick={() => setActiveTab("sme")}
          className={`flex-1 py-3 px-4 font-mono text-xs font-bold uppercase tracking-wider text-center border-r border-border transition-colors ${
            activeTab === "sme"
              ? "text-primary bg-slate-900/50"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          SME Financing Calculator
        </button>
        <button
          onClick={() => setActiveTab("lp")}
          className={`flex-1 py-3 px-4 font-mono text-xs font-bold uppercase tracking-wider text-center transition-colors ${
            activeTab === "lp"
              ? "text-primary bg-slate-900/50"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          LP Yield Estimator
        </button>
      </div>

      <div className="p-6 space-y-6">
        {activeTab === "sme" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Inputs Column */}
            <div className="space-y-6">
              <h3 className="text-xs font-bold font-mono text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                Configure Invoice parameters
              </h3>

              {/* Slider 1: Face Value */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400">Invoice Face Value</span>
                  <span className="text-primary font-bold">
                    {faceValue.toLocaleString()} USDC
                  </span>
                </div>
                <input
                  id="discount-sme-face-value"
                  type="range"
                  min="1000"
                  max="500000"
                  step="1000"
                  value={faceValue}
                  onChange={(e) => setFaceValue(parseInt(e.target.value))}
                  className="w-full accent-primary bg-slate-900 h-1.5 rounded"
                  aria-label="Invoice Face Value"
                  aria-valuenow={faceValue}
                  aria-valuemin={1000}
                  aria-valuemax={500000}
                />
                <div className="flex justify-between text-[10px] text-slate-600 font-mono">
                  <span>$1K USDC</span>
                  <span>$500K USDC</span>
                </div>
              </div>

              {/* Dropdown: Payment Terms */}
              <div className="space-y-2">
                <label className="block text-xs font-mono text-slate-400">
                  Payment Due Terms
                </label>
                <select
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(parseInt(e.target.value))}
                  className="w-full bg-[#080c10] border border-border rounded px-3 py-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-primary"
                >
                  <option value="30">Net 30 (30 days maturity)</option>
                  <option value="60">Net 60 (60 days maturity)</option>
                  <option value="90">Net 90 (90 days maturity)</option>
                </select>
              </div>

              {/* Slider 2: Discount Rate */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400">
                    Financing Discount Rate
                  </span>
                  <span className="text-primary font-bold">
                    {discountRate.toFixed(1)}% ({Math.round(discountRate * 100)}{" "}
                    bps)
                  </span>
                </div>
                <input
                  id="discount-sme-discount-rate"
                  type="range"
                  min="0.5"
                  max="5.0"
                  step="0.1"
                  value={discountRate}
                  onChange={(e) => setDiscountRate(parseFloat(e.target.value))}
                  className="w-full accent-primary bg-slate-900 h-1.5 rounded"
                  aria-label="Financing Discount Rate"
                  aria-valuenow={discountRate}
                  aria-valuemin={0.5}
                  aria-valuemax={5.0}
                />
                <div className="flex justify-between text-[10px] text-slate-600 font-mono">
                  <span>0.5% (50 bps)</span>
                  <span>5.0% (500 bps)</span>
                </div>
              </div>
            </div>

            {/* Outputs Column */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Without TrusTrove */}
              <div className="bg-[#080c10] border border-border p-4 rounded-lg flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider mb-3">
                    Without TrusTrove
                  </div>
                  <div className="space-y-4">
                    <div>
                      <span className="text-[10px] text-slate-500 font-mono block">
                        You wait:
                      </span>
                      <span className="text-lg font-bold font-mono text-amber-500">
                        {paymentTerms} Days
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-mono block">
                        You receive:
                      </span>
                      <span className="text-md font-bold text-slate-300 font-mono">
                        {faceValue.toLocaleString()} USDC
                      </span>
                      <span className="text-[9px] text-slate-600 block leading-tight mt-1">
                        Full payment received late, freezing working capital.
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border/30 pt-3 mt-4 text-[10px] font-mono space-y-1.5 text-slate-500">
                  <div className="flex justify-between">
                    <span>Opportunity cost:</span>
                    <span className="text-slate-400 text-right">
                      Lost production orders
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Bank alternative:</span>
                    <span className="text-slate-400 text-right">
                      8–15% APR, 3-week wait
                    </span>
                  </div>
                </div>
              </div>

              {/* With TrusTrove */}
              <div className="bg-[#080c10] border border-primary/20 p-4 rounded-lg flex flex-col justify-between shadow-[inset_0_0_15px_rgba(0,212,170,0.02)]">
                <div>
                  <div className="text-[10px] font-bold font-mono text-primary uppercase tracking-wider mb-3">
                    With TrusTrove
                  </div>
                  <div className="space-y-4">
                    <div>
                      <span className="text-[10px] text-slate-500 font-mono block">
                        You wait:
                      </span>
                      <span className="text-lg font-bold font-mono text-primary">
                        0 Days (Instant)
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-mono block">
                        You receive today:
                      </span>
                      <span className="text-md font-bold text-emerald-400 font-mono">
                        <AnimatedValue value={fundedAmount} suffix=" USDC" />
                      </span>
                      <span className="text-[9px] text-slate-500 block leading-tight mt-1">
                        Face Value minus{" "}
                        <AnimatedValue
                          value={discountPaid}
                          prefix="-"
                          suffix=" USDC"
                        />{" "}
                        discount fee.
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border/30 pt-3 mt-4 text-[10px] font-mono space-y-1.5 text-slate-500">
                  <div className="flex justify-between">
                    <span>Discount paid:</span>
                    <span className="text-slate-300 font-bold">
                      <AnimatedValue value={discountPaid} suffix=" USDC" />
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Yield distributed:</span>
                    <span className="text-primary font-bold">
                      <AnimatedValue value={discountPaid} suffix=" USDC" />
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Buyer obligation:</span>
                    <span className="text-slate-300">
                      {faceValue.toLocaleString()} USDC
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // LP Tab
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
                  <span className="text-slate-400">
                    Target Pool Utilization
                  </span>
                  <span className="text-primary font-bold">
                    {lpUtilization}%
                  </span>
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
                  <span className="text-slate-400">
                    Avg Invoice Discount Bps
                  </span>
                  <span className="text-primary font-bold">
                    {lpAvgDiscount.toFixed(1)}% (
                    {Math.round(lpAvgDiscount * 100)} bps)
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
                  <span className="text-primary font-bold">
                    {lpAvgMaturity} Days
                  </span>
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
                      {lpAvgDiscount}%) × (365 / Avg Maturity ({lpAvgMaturity}
                      d))
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
                USDC is never idle. Invoices listed by SMEs are funded
                automatically by the pool contract using liquid deposits,
                allocating discount fees to LPs proportionally.
              </div>
            </div>
          </div>
        )}

        {/* Disclaimer row */}
        <div className="border-t border-border pt-4 text-center">
          <span className="text-[10px] text-slate-500 font-mono block">
            TrusTrove charges what the market sets. Discount rates are agreed
            between the SME and the protocol. No hidden fees.
          </span>
        </div>
      </div>
    </div>
  );
}
