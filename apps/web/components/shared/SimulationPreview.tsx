import React from "react";
import { Cpu, Coins, ShieldAlert, Sparkles } from "lucide-react";

interface SimulationDetails {
  estimatedFeeXlm: string;
  functionName: string;
  expectedResult: any;
  footprintSize: number;
}

interface SimulationPreviewProps {
  details: SimulationDetails | null;
  error: string | null;
  isLoading: boolean;
  isFallback?: boolean;
}

export function SimulationPreview({
  details,
  error,
  isLoading,
  isFallback,
}: SimulationPreviewProps) {
  if (isLoading) {
    return (
      <div className="bg-slate-900/40 border border-border/60 rounded-lg p-4 font-mono text-xs animate-pulse space-y-3">
        <div className="flex justify-between items-center border-b border-border/30 pb-2">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Simulating Transaction...</span>
          </div>
          <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-4 bg-slate-800 rounded w-3/4"></div>
          <div className="h-4 bg-slate-800 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-4 font-mono text-xs text-rose-400 space-y-2">
        <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-rose-500">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>Simulation Failed</span>
        </div>
        <p className="leading-relaxed text-[11px] bg-black/30 p-2 rounded border border-rose-500/10">
          {error}
        </p>
      </div>
    );
  }

  if (!details) {
    if (isFallback) {
      return (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 font-mono text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-amber-500">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>Simulation Unavailable</span>
          </div>
          <p className="text-[11px] text-amber-400/70 leading-relaxed">
            Live simulation data is currently unavailable. The fee shown at
            signing time may differ from this preview.
          </p>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="bg-[#0b1219]/60 backdrop-blur border border-primary/20 rounded-lg p-4 font-mono text-xs space-y-3 shadow-[0_0_15px_rgba(0,212,170,0.02)]">
      <div className="flex justify-between items-center border-b border-border/40 pb-2">
        <div className="flex items-center gap-1.5 text-slate-300 font-bold uppercase tracking-wider text-[10px]">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span>Transaction Preview</span>
        </div>
        <div className="flex items-center gap-1.5">
          {isFallback ? (
            <span className="text-[9px] text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded uppercase font-bold">
              Estimate
            </span>
          ) : (
            <span className="text-[9px] text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-1.5 py-0.5 rounded uppercase font-bold">
              Ready to Sign
            </span>
          )}
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isFallback ? "bg-amber-400" : "bg-emerald-400"} opacity-75`}
            ></span>
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${isFallback ? "bg-amber-500" : "bg-emerald-500"}`}
            ></span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <span className="text-[9px] text-slate-500 uppercase block font-bold">
            Method
          </span>
          <span className="text-white font-bold flex items-center gap-1">
            <Cpu className="w-3 h-3 text-slate-400" />
            {details.functionName}
          </span>
        </div>
        <div className="space-y-1">
          <span className="text-[9px] text-slate-500 uppercase block font-bold">
            Footprint Size
          </span>
          <span className="text-white font-bold">
            {details.footprintSize}{" "}
            {details.footprintSize === 1 ? "ledger entry" : "ledger entries"}
          </span>
        </div>
        <div className="space-y-1 col-span-2 border-t border-border/30 pt-2 flex justify-between items-center">
          <span className="text-[9.5px] text-slate-400 uppercase font-bold flex items-center gap-1">
            <Coins className="w-3.5 h-3.5 text-primary" />
            Estimated network fee
          </span>
          <span className="text-primary font-bold text-sm">
            {details.estimatedFeeXlm} XLM
          </span>
        </div>
      </div>
    </div>
  );
}
