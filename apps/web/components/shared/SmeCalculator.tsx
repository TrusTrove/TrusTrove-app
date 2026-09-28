"use client";

import React, { useState } from "react";
import { Sparkles } from "lucide-react";
import { AnimatedValue } from "./DiscountCalculator";

export function SmeCalculator() {
  const [faceValue, setFaceValue] = useState<number>(50000);
  const [paymentTerms, setPaymentTerms] = useState<number>(60);
  const [discountRate, setDiscountRate] = useState<number>(2.0);

  const discountPaid = faceValue * (discountRate / 100);
  const fundedAmount = faceValue - discountPaid;

  return (
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
            <span className="text-slate-400">Financing Discount Rate</span>
            <span className="text-primary font-bold">
              {discountRate.toFixed(1)}% ({Math.round(discountRate * 100)} bps)
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
  );
}
