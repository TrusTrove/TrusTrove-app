"use client";

import React, { useState, useEffect, useRef } from "react";
import { SmeCalculator } from "./SmeCalculator";
import { LpCalculator } from "./LpCalculator";

export function AnimatedValue({
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
        {activeTab === "sme" ? <SmeCalculator /> : <LpCalculator />}

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
