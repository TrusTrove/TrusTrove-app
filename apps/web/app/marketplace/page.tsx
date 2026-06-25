'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { PageLayout } from '@/components/shared/PageLayout';
import { InvoiceTable } from '@/components/invoice/InvoiceTable';
import { InvoiceCard } from '@/components/invoice/InvoiceCard';
import { useInvoices } from '@/hooks/useInvoices';
import { usePool } from '@/hooks/usePool';
import { useWalletStore } from '@/store/wallet';
import { useProfile } from '@/hooks/useProfile';
import { Invoice } from '@/types';
import { formatAmount } from '@/lib/assets';
import { ShieldAlert } from 'lucide-react';

export default function Marketplace() {
  const { connected, role } = useWalletStore();
  const { isVerified } = useProfile();
  const { stats, isStatsLoading } = usePool();
  const [statusFilter, setStatusFilter] = useState<string>('Listed');
  
  // Filter States
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [maxDiscount, setMaxDiscount] = useState('500'); // 500 bps max
  
  const { invoices, isLoading } = useInvoices({ 
    status: statusFilter === 'ALL' ? undefined : statusFilter 
  });
  
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Filter and Sort Invoices
  const filteredAndSortedInvoices = useMemo(() => {
    let result = [...invoices];

    // Filter by Min Amount
    if (minAmount) {
      const minStroops = BigInt(parseFloat(minAmount) * 10_000_000);
      result = result.filter(inv => inv.faceValue >= minStroops);
    }

    // Filter by Max Amount
    if (maxAmount) {
      const maxStroops = BigInt(parseFloat(maxAmount) * 10_000_000);
      result = result.filter(inv => inv.faceValue <= maxStroops);
    }

    // Filter by Max Discount Rate (bps)
    const discBps = parseInt(maxDiscount, 10);
    if (!isNaN(discBps)) {
      result = result.filter(inv => inv.discountBps <= discBps);
    }

    // Sort by Face Value Descending by default
    return result.sort((a, b) => {
      if (b.faceValue > a.faceValue) return 1;
      if (b.faceValue < a.faceValue) return -1;
      return 0;
    });
  }, [invoices, minAmount, maxAmount, maxDiscount]);

  // Calculate funded amount preview (face value - discount fee)
  const calculateFundingValue = (faceValue: bigint, discountBps: number) => {
    const value = Number(faceValue);
    const fee = value * (discountBps / 10000);
    return BigInt(Math.floor(value - fee));
  };

  return (
    <PageLayout>
      <div className="space-y-8 py-4">
        {/* Header */}
        <div className="border-b border-border/40 pb-5">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-xl font-bold font-mono tracking-wider uppercase text-white">Invoice Marketplace</h1>
              <p className="text-slate-500 text-xs font-mono mt-1">
                Audit list of tokenized trade obligations listed on the Stellar Soroban network.
              </p>
            </div>
            
            {/* Top Available Liquidity indicator */}
            <div className="bg-[#0d131a] border border-border rounded-lg px-4 py-2 text-right font-mono">
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Pool Liquidity Available</span>
              <span className="text-sm font-bold text-primary block mt-0.5">
                {isStatsLoading ? 'Syncing...' : formatAmount(stats?.availableLiquidity)}
              </span>
            </div>
          </div>
        </div>

        {/* Warning Banner for Unverified Profiles */}
        {connected && !isVerified && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-start gap-3 font-mono text-xs text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.02)]">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold uppercase">Profile Verification Required</span>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                Your connected wallet address is not verified on-chain. To fund invoices or execute smart contract operations, you must register your business credentials. Go to the <Link href="/profile" className="text-primary hover:underline font-bold">[Profile Page]</Link> to register.
              </p>
            </div>
          </div>
        )}

        {/* Filter bar */}
        <div className="bg-[#0d131a] border border-border rounded-lg p-4 grid grid-cols-1 md:grid-cols-4 gap-4 font-mono text-xs items-end">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 font-bold uppercase">Maturity Status</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setSelectedInvoice(null);
              }}
              className="w-full bg-[#080c10] border border-border rounded px-3 py-1.5 text-white focus:outline-none focus:border-primary cursor-pointer"
            >
              <option value="ALL">All Invoices</option>
              <option value="Created">Created</option>
              <option value="Listed">Listed (Awaiting Liquidity)</option>
              <option value="Funded">Funded (USDC Deployed)</option>
              <option value="Active">Active (Shipped)</option>
              <option value="Confirmed">Confirmed (Delivered)</option>
              <option value="Repaid">Repaid (Settled)</option>
              <option value="Defaulted">Defaulted</option>
            </select>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 font-bold uppercase">Min Value</span>
            <input
              type="number"
              placeholder="e.g. 5000"
              className="w-full bg-[#080c10] border border-border rounded px-3 py-1.5 text-white focus:outline-none focus:border-primary"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 font-bold uppercase">Max Value</span>
            <input
              type="number"
              placeholder="e.g. 50000"
              className="w-full bg-[#080c10] border border-border rounded px-3 py-1.5 text-white focus:outline-none focus:border-primary"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-500 font-bold uppercase">Max Discount Rate</span>
              <span className="text-primary font-bold">{(parseInt(maxDiscount) / 100).toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="500"
              step="50"
              className="w-full accent-primary bg-slate-900 h-1.5 rounded"
              value={maxDiscount}
              onChange={(e) => setMaxDiscount(e.target.value)}
            />
          </div>
        </div>

        {/* Marketplace Contents */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Marketplace List (Left) */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-bold font-mono tracking-wider uppercase text-white">
                Available Invoices ({filteredAndSortedInvoices.length})
              </h2>
              {isLoading && <span className="text-xs text-primary animate-pulse font-mono uppercase">Syncing...</span>}
            </div>

            {/* Invoices Table */}
            <InvoiceTable 
              invoices={filteredAndSortedInvoices} 
              onSelectInvoice={(invoice) => setSelectedInvoice(invoice)} 
              activeId={selectedInvoice?.id}
              emptyState={
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <p className="text-slate-500 text-xs font-mono mb-6 leading-relaxed max-w-xs">
                    No invoices match your filters
                  </p>
                  <button
                    onClick={() => {
                      setStatusFilter('Listed');
                      setMinAmount('');
                      setMaxAmount('');
                      setMaxDiscount('500');
                      setSelectedInvoice(null);
                    }}
                    className="border border-border hover:border-primary/50 text-slate-300 hover:text-white font-bold text-xs uppercase tracking-wider rounded px-4 py-2.5 transition-all"
                  >
                    Reset Filters
                  </button>
                </div>
              }
            />

            {/* Mobile Cards view (hidden on desktop, but let's implement layout) */}
            <div className="md:hidden space-y-4">
              {filteredAndSortedInvoices.map((invoice) => (
                <InvoiceCard 
                  key={invoice.id} 
                  invoice={invoice} 
                  role={role} 
                  onSelect={() => setSelectedInvoice(invoice)}
                  isSelected={selectedInvoice?.id === invoice.id}
                />
              ))}
            </div>
          </div>

          {/* Console Management Center (Right) */}
          <div className="lg:col-span-4 space-y-4">
            <h2 className="text-sm font-bold font-mono tracking-wider uppercase text-white">Management Center</h2>
            
            {selectedInvoice ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="text-slate-500 uppercase">
                    Consoling role: <strong className="text-primary uppercase">{connected ? role : 'PUBLIC VIEW'}</strong>
                  </span>
                  <button
                    onClick={() => setSelectedInvoice(null)}
                    className="text-primary hover:underline uppercase font-bold"
                  >
                    Clear select
                  </button>
                </div>
                
                {/* LP Action: Fund from Pool Preview */}
                {selectedInvoice.status === 'Listed' && role === 'lp' && connected && (
                  <div className="bg-[#0d131a] border border-primary/20 rounded p-4 text-xs font-mono space-y-2">
                    <span className="text-primary font-bold block uppercase text-[10px] tracking-wider">POOL FINANCING PREVIEW</span>
                    <div className="flex justify-between">
                      <span>Face Value:</span>
                      <span>{formatAmount(selectedInvoice.faceValue, selectedInvoice.asset)}</span>
                    </div>
                    <div className="flex justify-between text-primary font-bold">
                      <span>Funded Cost (at {selectedInvoice.discountBps} bps):</span>
                      <span>{formatAmount(calculateFundingValue(selectedInvoice.faceValue, selectedInvoice.discountBps), selectedInvoice.asset)}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 pt-1 leading-normal border-t border-border/20 mt-1">
                      Funding this invoice deploys USDC from the pool contract into escrow. LPs earn the discount difference upon repayment.
                    </div>
                  </div>
                )}

                <InvoiceCard invoice={selectedInvoice} role={connected ? role : undefined} isSelected />
              </div>
            ) : (
              <div className="bg-card border border-dashed border-border rounded-lg p-6 text-center text-slate-500 font-mono text-[10px] py-20 uppercase tracking-wider">
                <p className="mb-2 font-bold text-slate-400">NO INVOICE SELECTED</p>
                <p className="normal-case text-slate-500 leading-relaxed max-w-[200px] mx-auto">
                  Select an obligation from the ledger table to view its parameters and execute smart contract actions.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
