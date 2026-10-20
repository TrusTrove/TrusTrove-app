"use client";

import React, { useEffect, useState } from "react";
import { ArrowUpRight, Pause, Play } from "lucide-react";
import { useRecentEvents } from "@/hooks/useEvents";
import {
  getEventDataBigInt,
  getEventDataNumber,
  getEventDataString,
  type EventLog,
} from "@/types";

interface TickerItem {
  id: string;
  sme: string;
  amount: string;
  discount: string;
  time: string;
  country: string;
}

export function TopStatusBar() {
  const { events: rawEvents, isLoading, error } = useRecentEvents(20);
  const isError = error !== null;
  const [tickerItems, setTickerItems] = useState<TickerItem[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const showPlaceholder = !isLoading && !isError && !rawEvents?.length;

  // Detect mobile screen size to hide ticker on small screens
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640); // sm breakpoint
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Clear ticker items when switching to mobile to prevent unnecessary rendering
  useEffect(() => {
    if (isMobile) {
      setTickerItems([]);
    }
  }, [isMobile]);

  // Format event for display in the ticker
  const formatEventForTicker = (event: EventLog): TickerItem => {
    // Extract amount from event data (assuming it's in USDC)
    let amount = "0 USDC";
    const invoiceAmount =
      getEventDataBigInt(event, "funded_amount") ??
      getEventDataBigInt(event, "face_value");
    if (invoiceAmount !== undefined) {
      const amountInUSDC = Number(invoiceAmount / 10_000_000n); // Convert from stroops (7 decimals) to USDC
      amount = `${Math.round(amountInUSDC).toLocaleString()} USDC`;
    }

    // Extract discount from event data (in basis points)
    let discount = "0.0%";
    const discountBps = getEventDataNumber(event, "discount_bps");
    if (discountBps !== undefined) {
      const discountPercent = discountBps / 100;
      discount = `${discountPercent.toFixed(1)}%`;
    }

    // Calculate time ago
    const now = Math.floor(Date.now() / 1000);
    const diff = now - event.ledger_closed_at;
    let time = "";
    if (diff < 60) time = "just now";
    else if (diff < 3600) time = `${Math.floor(diff / 60)}m ago`;
    else if (diff < 86400) time = `${Math.floor(diff / 3600)}h ago`;
    else time = `${Math.floor(diff / 86400)}d ago`;

    // #1105: the flag used to be derived by hashing event.id into a flagMap,
    // which fabricated country geography unrelated to any on-chain data.
    // Events carry no issuer/buyer country metadata, so render the neutral
    // placeholder globe for every event instead.
    const flag = "🌍";

    // Generate SME name based on event data
    let sme = "Unknown SME";
    const buyer = getEventDataString(event, "buyer");
    const issuer = getEventDataString(event, "issuer");
    if (buyer) {
      sme = `${buyer.slice(0, 8)}...`;
    } else if (issuer) {
      sme = `${issuer.slice(0, 8)}...`;
    }

    return {
      id: event.id.toString(),
      sme,
      amount,
      discount,
      time,
      country: flag,
    };
  };

  useEffect(() => {
    // Only fetch and set ticker items if not on mobile (performance optimization)
    if (!isMobile && rawEvents && rawEvents.length > 0) {
      // Convert events to ticker items
      const items = rawEvents.map(formatEventForTicker);
      setTickerItems(items);
    }
  }, [rawEvents, isMobile]);

  // If no real data, show some placeholder items to maintain the ticker effect
  useEffect(() => {
    // Only set placeholder items if not on mobile
    if (!isMobile && showPlaceholder) {
      const placeholderItems: TickerItem[] = [
        {
          id: "1",
          sme: "Awaiting...",
          amount: "0 USDC",
          discount: "0.0%",
          time: "live",
          country: "🌍",
        },
        {
          id: "2",
          sme: "Awaiting...",
          amount: "0 USDC",
          discount: "0.0%",
          time: "live",
          country: "🌍",
        },
        {
          id: "3",
          sme: "Awaiting...",
          amount: "0 USDC",
          discount: "0.0%",
          time: "live",
          country: "🌍",
        },
        {
          id: "4",
          sme: "Awaiting...",
          amount: "0 USDC",
          discount: "0.0%",
          time: "live",
          country: "🌍",
        },
        {
          id: "5",
          sme: "Awaiting...",
          amount: "0 USDC",
          discount: "0.0%",
          time: "live",
          country: "🌍",
        },
      ];
      setTickerItems(placeholderItems);
    }
  }, [showPlaceholder, isMobile]);

  // Clear ticker items when switching to mobile to prevent unnecessary rendering
  useEffect(() => {
    if (isMobile) {
      setTickerItems([]);
    }
  }, [isMobile]);

  return (
    <div className="w-full bg-[#080c10] border-b border-border py-0.5 px-4 overflow-hidden relative z-40 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4">
      {/* Network indicator */}
      <div className="flex items-center gap-2 shrink-0 border-r border-border pr-4 w-full sm:w-auto justify-center sm:justify-start">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
        </span>
        <span className="text-[10px] font-bold font-mono tracking-widest text-primary uppercase">
          SOROBAN TESTNET — PROTOCOL V1.0
        </span>
      </div>

      {/* Scrolling Ticker - hidden on mobile */}
      {!isMobile && (
        <div
          className="flex-1 flex items-center gap-2 overflow-hidden"
          role="status"
          aria-live="polite"
          aria-label="Recent network activity"
        >
          <button
            onClick={() => setIsPaused(!isPaused)}
            // 24x24 hit area (WCAG 2.5.8). The bar uses py-0.5 so its height stays
            // 28px; the ring is inset so the overflow-hidden row cannot clip it.
            // slate-400 is ~7:1 against the #080c10 bar.
            className="inline-flex items-center justify-center min-w-[24px] min-h-[24px] rounded text-slate-400 hover:text-white focus:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary shrink-0 z-10 transition-colors"
            aria-label={isPaused ? "Play ticker" : "Pause ticker"}
          >
            {isPaused ? (
              <Play className="w-3 h-3" />
            ) : (
              <Pause className="w-3 h-3" />
            )}
          </button>
          <div className="flex-1 overflow-hidden relative h-4 flex items-center group">
            {isLoading ? (
              <div className="inline-flex items-center gap-2 text-[10px] font-mono text-slate-300">
                <span className="inline-block h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
                <span>Loading live network activity...</span>
              </div>
            ) : isError ? (
              <div className="inline-flex items-center gap-2 text-[10px] font-mono text-amber-300">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
                <span>Live feed unavailable</span>
              </div>
            ) : (
              <div
                className={`flex gap-12 whitespace-nowrap animate-[marquee_25s_linear_infinite] group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused] motion-reduce:animate-none ${isPaused ? "[animation-play-state:paused]" : ""}`}
              >
                {tickerItems.map((item, idx) => (
                  <div
                    key={`${item.id}-${idx}`}
                    className="inline-flex items-center gap-2 text-[10px] font-mono"
                  >
                    <span className="text-slate-500">{item.country}</span>
                    <span className="text-slate-300 font-bold">{item.sme}</span>
                    <span className="text-primary font-bold">
                      {item.amount}
                    </span>
                    <span className="text-slate-500">at</span>
                    <span className="text-sky-400 font-semibold">
                      {item.discount} discount
                    </span>
                    <span className="text-slate-600">({item.time})</span>
                    <ArrowUpRight className="w-3 h-3 text-primary/45 shrink-0" />
                  </div>
                ))}
                {/* Duplicate for seamless scrolling, hidden from screen readers */}
                {tickerItems.map((item, idx) => (
                  <div
                    key={`dup-${item.id}-${idx}`}
                    aria-hidden="true"
                    className="inline-flex items-center gap-2 text-[10px] font-mono"
                  >
                    <span className="text-slate-500">{item.country}</span>
                    <span className="text-slate-300 font-bold">{item.sme}</span>
                    <span className="text-primary font-bold">
                      {item.amount}
                    </span>
                    <span className="text-slate-500">at</span>
                    <span className="text-sky-400 font-semibold">
                      {item.discount} discount
                    </span>
                    <span className="text-slate-600">({item.time})</span>
                    <ArrowUpRight className="w-3 h-3 text-primary/45 shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes marquee {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-\\[marquee_25s_linear_infinite\\] {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
