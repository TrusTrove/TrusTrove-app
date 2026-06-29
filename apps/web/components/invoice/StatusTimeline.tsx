"use client";

import React from "react";
import { InvoiceStatus } from "@/types";
import { Check } from "lucide-react";

interface StatusTimelineProps {
  status: InvoiceStatus;
  timestamps: {
    created?: number;
    listed?: number;
    funded?: number;
    shipped?: number;
    confirmed?: number;
    repaid?: number;
    defaulted?: number;
  };
}

const steps: { key: InvoiceStatus; label: string }[] = [
  { key: "Created", label: "Created" },
  { key: "Listed", label: "Listed" },
  { key: "Funded", label: "Funded" },
  { key: "Active", label: "Active" },
  { key: "Confirmed", label: "Confirmed" },
  { key: "Repaid", label: "Repaid" },
];

export function StatusTimeline({ status, timestamps }: StatusTimelineProps) {
  const getStatusIndex = (s: InvoiceStatus) => {
    if (s === "Defaulted") return -1;
    return steps.findIndex((step) => step.key === s);
  };

  const currentIdx = getStatusIndex(status);

  const getStepTimestamp = (s: InvoiceStatus) => {
    switch (s) {
      case "Created":
        return timestamps.created;
      case "Listed":
        return timestamps.listed;
      case "Funded":
        return timestamps.funded;
      case "Active":
        return timestamps.shipped;
      case "Confirmed":
        return timestamps.confirmed;
      case "Repaid":
        return timestamps.repaid;
      default:
        return undefined;
    }
  };

  const formatDate = (ts?: number) => {
    if (!ts) return "";
    return new Date(ts * 1000).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (status === "Defaulted") {
    return (
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center gap-3 text-amber-400 font-mono text-xs">
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
        <div>
          <span className="font-bold uppercase tracking-wider block">
            INVOICE DEFAULT TRIGGERED
          </span>
          <span className="text-[10px] text-slate-400">
            Payment due date has elapsed without repayment. Recoveries handled
            on-chain.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full py-4 overflow-x-auto">
      <div className="min-w-[600px] flex items-center justify-between relative px-2">
        {/* Progress Line */}
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-border -z-10 mx-6" />
        <div
          className="absolute top-4 left-0 h-0.5 bg-emerald-500 -z-10 transition-all duration-500 mx-6"
          style={{
            width: `${(Math.max(0, currentIdx) / (steps.length - 1)) * 92}%`,
          }}
        />

        {steps.map((step, idx) => {
          const isCompleted = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const ts = getStepTimestamp(step.key);

          return (
            <div
              key={step.key}
              className="flex flex-col items-center flex-1 relative"
            >
              {/* Node Circle */}
              <div
                className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all duration-300 ${
                  isCompleted
                    ? "bg-emerald-500/10 border-emerald-500 text-emerald-400"
                    : isCurrent
                      ? "bg-[#080c10] border-teal-400 text-teal-400 shadow-[0_0_15px_rgba(0,212,170,0.25)]"
                      : "bg-[#080c10] border-border text-slate-600"
                }`}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4" />
                ) : isCurrent ? (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal-400"></span>
                  </span>
                ) : (
                  <span className="text-xs font-mono font-bold">{idx + 1}</span>
                )}
              </div>

              {/* Label details */}
              <div className="text-center mt-3">
                <span
                  className={`text-[10px] font-bold font-mono uppercase tracking-wider block ${
                    isCurrent
                      ? "text-teal-400"
                      : isCompleted
                        ? "text-emerald-400"
                        : "text-slate-500"
                  }`}
                >
                  {step.label}
                </span>
                {ts && (
                  <span className="text-[9px] font-mono text-slate-500 block mt-0.5">
                    {formatDate(ts)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
