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
  const { events: rawEvents, isLoading, isError } = useRecentEvents(20);
  const [tickerItems, setTickerItems] = useState<TickerItem[]>([]);

  // Format event for display in the ticker
  const formatEventForTicker = (event: EventLog): TickerItem => {
    // Extract amount from event data (assuming it's in USDC)
    let amount = '0 USDC';
    if (event.data && event.data.funded_amount) {
      const amountInUSDC = Number(event.data.funded_amount) / 1000000; // Convert from stroops to USDC
      amount = `${Math.round(amountInUSDC).toLocaleString()} USDC`;
    } else if (event.data && event.data.face_value) {
      const amountInUSDC = Number(event.data.face_value) / 1000000; // Convert from stroops to USDC
      amount = `${Math.round(amountInUSDC).toLocaleString()} USDC`;
    }

    // Extract discount from event data (in basis points)
    let discount = '0.0%';
    if (event.data && event.data.discount_bps) {
      const discountPercent = Number(event.data.discount_bps) / 100;
      discount = `${discountPercent.toFixed(1)}%`;
    }

    // Calculate time ago
    const now = Math.floor(Date.now() / 1000);
    const diff = now - event.ledger_closed_at;
    let time = '';
    if (diff < 60) time = 'just now';
    else if (diff < 3600) time = `${Math.floor(diff / 60)}m ago`;
    else if (diff < 86400) time = `${Math.floor(diff / 3600)}h ago`;
    else time = `${Math.floor(diff / 86400)}d ago`;

    // Determine country/flag based on issuer or buyer (simplified hash-based)
    const flagMap: Record<string, string> = {
      '0': '🇳🇬', '1': '🇰🇪', '2': '🇬🇭', '3': '🇸🇳', '4': '🇺🇬', 
      '5': '🇨🇮', '6': '🇹🇬', '7': '🇧🇯', '8': '🇸🇱', '9': '🇱🇷'
    };
    const hash = Array.from(event.id.toString()).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const flag = flagMap[hash % 10] || '🌍';

    // Generate SME name based on event data
    let sme = 'Unknown SME';
    if (event.data.buyer) {
      sme = `${event.data.buyer.slice(0, 8)}...`;
    } else if (event.data.issuer) {
      sme = `${event.data.issuer.slice(0, 8)}...`;
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
    if (rawEvents && rawEvents.length > 0) {
      // Convert events to ticker items
      const items = rawEvents.map(formatEventForTicker);
      setTickerItems(items);
    }
  }, [rawEvents]);

  // If no real data, show some placeholder items to maintain the ticker effect
  useEffect(() => {
    if (!rawEvents || rawEvents.length === 0) {
      // Show placeholder items when no real data is available
      const placeholderItems: TickerItem[] = [
        { id: '1', sme: 'Awaiting...', amount: '0 USDC', discount: '0.0%', time: 'live', country: '🌍' },
        { id: '2', sme: 'Awaiting...', amount: '0 USDC', discount: '0.0%', time: 'live', country: '🌍' },
        { id: '3', sme: 'Awaiting...', amount: '0 USDC', discount: '0.0%', time: 'live', country: '🌍' },
        { id: '4', sme: 'Awaiting...', amount: '0 USDC', discount: '0.0%', time: 'live', country: '🌍' },
        { id: '5', sme: 'Awaiting...', amount: '0 USDC', discount: '0.0%', time: 'live', country: '🌍' },
      ];
      setTickerItems(placeholderItems);
    }
  }, [rawEvents]);

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
