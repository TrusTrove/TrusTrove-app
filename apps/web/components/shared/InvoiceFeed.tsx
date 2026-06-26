'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDownLeft, Zap } from 'lucide-react';
import { useRecentEvents } from '@/hooks/useEvents';
import { EventLog } from '@/types';

interface FeedItem {
  id: string;
  type: string;
  amount: string;
  time: string;
  discount: string;
  flag: string;
}

export function InvoiceFeed() {
  const { events: rawEvents, isLoading, isError } = useRecentEvents(8);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [counter, setCounter] = useState(0);

  // Format event for display in the feed
  const formatEventForFeed = (event: EventLog): FeedItem => {
    // Map event type to a readable format
    const typeMap: Record<string, string> = {
      InvoiceCreated: 'Invoice Created',
      InvoiceListed: 'Invoice Listed',
      InvoiceFunded: 'Invoice Funded',
      InvoiceShipped: 'Invoice Shipped',
      DeliveryConfirmed: 'Delivery Confirmed',
      InvoiceRepaid: 'Invoice Repaid',
      InvoiceDefaulted: 'Invoice Defaulted',
    };

    const eventType = typeMap[event.event_type] || event.event_type.replace(/_/g, ' ');
    
    // Extract amount from event data (assuming it's in USDC)
    let amount = '$0 USDC';
    if (event.data && event.data.funded_amount) {
      const amountInUSDC = Number(event.data.funded_amount) / 1000000; // Convert from stroops to USDC
      amount = `$${amountInUSDC.toLocaleString(undefined, { maximumFractionDigits: 0 })} USDC`;
    } else if (event.data && event.data.face_value) {
      const amountInUSDC = Number(event.data.face_value) / 1000000; // Convert from stroops to USDC
      amount = `$${amountInUSDC.toLocaleString(undefined, { maximumFractionDigits: 0 })} USDC`;
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
    else if (diff < 3600) time = `${Math.floor(diff / 60)} min ago`;
    else if (diff < 86400) time = `${Math.floor(diff / 3600)}h ago`;
    else time = `${Math.floor(diff / 86400)}d ago`;

    // Determine flag based on issuer/buyer (simplified - using hash for demo)
    const flagMap: Record<string, string> = {
      '0': '🇳🇬', '1': '🇰🇪', '2': '🇬🇭', '3': '🇸🇳', '4': '🇺🇬', 
      '5': '🇨🇮', '6': '🇹🇬', '7': '🇧🇯', '8': '🇸🇱', '9': '🇱🇷'
    };
    const hash = Array.from(event.id).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const flag = flagMap[hash % 10] || '🌍';

    // Generate a readable type based on parties involved
    let type = eventType;
    if (event.data.buyer && event.data.issuer) {
      // Extract first part of name or use generic
      type = `${event.data.buyer?.slice(0, 8)}... ${eventType.toLowerCase()}`;
    }

    return {
      id: event.id.toString(),
      type,
      amount,
      time,
      discount,
      flag,
    };
  };

  useEffect(() => {
    if (rawEvents && rawEvents.length > 0) {
      // Convert events to feed items
      const feedItems = rawEvents.map(formatEventForFeed);
      setItems(feedItems.slice(0, 4)); // Show first 4 items
      setCounter(feedItems.length);
    }
  }, [rawEvents]);

  // Simulate periodic updates for demo purposes (in real app, this would come from real-time updates)
  useEffect(() => {
    if (!rawEvents || rawEvents.length === 0) return;

    const interval = setInterval(() => {
      // Rotate through events to show different ones
      if (rawEvents.length > 0) {
        const startIndex = counter % rawEvents.length;
        const endIndex = Math.min(startIndex + 4, rawEvents.length);
        const displayedEvents = rawEvents.slice(startIndex, endIndex);
        
        // If we don't have enough items, wrap around
        if (displayedEvents.length < 4 && rawEvents.length >= 4) {
          const remainingNeeded = 4 - displayedEvents.length;
          const wrappedEvents = rawEvents.slice(0, remainingNeeded);
          const allEvents = [...displayedEvents, ...wrappedEvents];
          setItems(allEvents.map(formatEventForFeed));
        } else {
          setItems(displayedEvents.map(formatEventForFeed));
        }
        
        setCounter((prev) => prev + 1);
      }
    }, 5000); // Change every 5 seconds

    return () => clearInterval(interval);
  }, [rawEvents, counter]);

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
        {isError ? (
          <div className="text-center py-8 text-slate-400 text-[9px] font-mono">
            Unable to load live feed
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: -40, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 40, scale: 0.95, position: 'absolute', bottom: 16, left: 16, right: 16 }}
                transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                className="bg-[#080c10] border border-border/40 p-3 rounded flex items-center justify-between gap-4 w-full"
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
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
