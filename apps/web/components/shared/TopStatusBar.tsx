"use client";

import React from "react";
import { ArrowUpRight } from "lucide-react";

interface TickerItem {
  id: string;
  sme: string;
  amount: string;
  discount: string;
  time: string;
  country: string;
}

const tickerItems: TickerItem[] = [
  {
    id: "1",
    sme: "Lagos Textile Supplier",
    amount: "34,500 USDC",
    discount: "2.1%",
    time: "3m ago",
    country: "🇳🇬",
  },
  {
    id: "2",
    sme: "Nairobi Agri-Exporter",
    amount: "18,200 USDC",
    discount: "1.8%",
    time: "8m ago",
    country: "🇰🇪",
  },
  {
    id: "3",
    sme: "Accra Electronics",
    amount: "52,000 USDC",
    discount: "2.5%",
    time: "12m ago",
    country: "🇬🇭",
  },
  {
    id: "4",
    sme: "Mombasa Logistics Ltd",
    amount: "27,800 USDC",
    discount: "2.0%",
    time: "22m ago",
    country: "🇰🇪",
  },
  {
    id: "5",
    sme: "Dakar Fish Processing",
    amount: "41,300 USDC",
    discount: "2.3%",
    time: "35m ago",
    country: "🇸🇳",
  },
];

export function TopStatusBar() {
  return (
    <div className="w-full bg-[#080c10] border-b border-border py-1.5 px-4 overflow-hidden relative z-40 flex items-center justify-between gap-4">
      {/* Network indicator */}
      <div className="flex items-center gap-2 shrink-0 border-r border-border pr-4">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
        </span>
        <span className="text-[10px] font-bold font-mono tracking-widest text-primary uppercase">
          SOROBAN TESTNET — PROTOCOL V1.0
        </span>
      </div>

      {/* Scrolling Ticker */}
      <div className="flex-1 overflow-hidden relative h-4 flex items-center">
        <div className="flex gap-12 whitespace-nowrap animate-[marquee_25s_linear_infinite] hover:[animation-play-state:paused]">
          {[...tickerItems, ...tickerItems].map((item, idx) => (
            <div
              key={`${item.id}-${idx}`}
              className="inline-flex items-center gap-2 text-[10px] font-mono"
            >
              <span className="text-slate-500">{item.country}</span>
              <span className="text-slate-300 font-bold">{item.sme}</span>
              <span className="text-primary font-bold">{item.amount}</span>
              <span className="text-slate-500">at</span>
              <span className="text-sky-400 font-semibold">
                {item.discount} discount
              </span>
              <span className="text-slate-600">({item.time})</span>
              <ArrowUpRight className="w-3 h-3 text-primary/45 shrink-0" />
            </div>
          ))}
        </div>
      </div>

      <style jsx global>{`
        @keyframes marquee {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}
