'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDownLeft, Zap } from 'lucide-react';

interface FeedItem {
  id: string;
  type: string;
  amount: string;
  time: string;
  discount: string;
  flag: string;
}

const mockFeedItems: FeedItem[] = [
  { id: '1', type: 'Lagos Textile Supplier', amount: '$34,500 USDC', time: 'Funded 3 min ago', discount: '2.1%', flag: '🇳🇬' },
  { id: '2', type: 'Nairobi Agri-Exporter', amount: '$18,200 USDC', time: 'Funded 8 min ago', discount: '1.8%', flag: '🇰🇪' },
  { id: '3', type: 'Accra Electronics', amount: '$52,000 USDC', time: 'Funded 12 min ago', discount: '2.5%', flag: '🇬🇭' },
  { id: '4', type: 'Mombasa Logistics', amount: '$27,800 USDC', time: 'Funded 22 min ago', discount: '2.0%', flag: '🇰🇪' },
  { id: '5', type: 'Dakar Fish Processing', amount: '$41,300 USDC', time: 'Funded 35 min ago', discount: '2.3%', flag: '🇸🇳' },
  { id: '6', type: 'Kampala Agri-Hub', amount: '$15,400 USDC', time: 'Funded 42 min ago', discount: '1.9%', flag: '🇺🇬' },
  { id: '7', type: 'Kumasi Cocoa Exporter', amount: '$63,000 USDC', time: 'Funded 58 min ago', discount: '2.4%', flag: '🇬🇭' },
];

export function InvoiceFeed() {
  const [items, setItems] = useState<FeedItem[]>(mockFeedItems.slice(0, 4));
  const indexRef = useRef(4);

  useEffect(() => {
    const interval = setInterval(() => {
      const nextItem = mockFeedItems[indexRef.current % mockFeedItems.length];

      setItems((prev) => [
        { ...nextItem, id: String(Date.now()) },
        ...prev.slice(0, 3),
      ]);

      indexRef.current += 1;
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="border border-border/80 bg-[#0d131a] rounded-lg overflow-hidden h-[340px] flex flex-col">
      <div className="bg-[#080c10] border-b border-border/40 px-4 py-3 flex items-center justify-between">
        <span className="text-[10px] font-bold font-mono tracking-widest text-primary uppercase flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5" />
          Live Financing Feed
        </span>
        <span className="text-[9px] font-mono text-slate-500 uppercase">Realtime testnet activity</span>
      </div>

      <div className="flex-1 p-4 relative overflow-hidden flex flex-col gap-3 justify-start">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className="bg-[#080c10] border border-border/40 p-3 rounded flex items-center justify-between gap-4 w-full animate-slide-in-down"
              style={{ animationFillMode: 'backwards', animationDelay: `${idx * 50}ms` }}
            >
              <div className="flex items-center gap-2">
                <div className="text-lg shrink-0 select-none">{item.flag}</div>
                <div className="min-w-0">
                  <span className="text-xs font-mono font-bold text-slate-300 block truncate">{item.type}</span>
                  <span className="text-[9px] font-mono text-slate-500 block">{item.time}</span>
                </div>
              </div>
              
              <div className="text-right shrink-0">
                <span className="text-xs font-mono font-bold text-primary block">{item.amount}</span>
                <span className="text-[9px] font-mono text-sky-400 font-semibold block flex items-center justify-end gap-0.5">
                  <ArrowDownLeft className="w-2.5 h-2.5" /> {item.discount} disc.
                </span>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
