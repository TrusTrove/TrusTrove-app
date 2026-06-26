'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { PageLayout } from '@/components/shared/PageLayout';
import { InvoiceForm } from '@/components/invoice/InvoiceForm';
import { InvoiceTable } from '@/components/invoice/InvoiceTable';
import { InvoiceCard } from '@/components/invoice/InvoiceCard';
import { useInvoices } from '@/hooks/useInvoices';
import { useRecentEvents } from '@/hooks/useEvents';
import { useWalletStore } from '@/store/wallet';
import { useProfile } from '@/hooks/useProfile';
import { WalletConnect } from '@/components/shared/WalletConnect';
import { InvoiceTableSkeleton, ActivityTimelineSkeleton } from '@/components/shared/SkeletonLoader';
import { Layers, Plus, ShieldAlert } from 'lucide-react';
import { Invoice } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { formatAmount } from '@/lib/assets';
import { useFocusTrap } from '@/hooks/useFocusTrap';

export default function SMEDashboard() {
  const { address, connected, role } = useWalletStore();
  const { invoices, isLoading } = useInvoices({ issuer: address || undefined });
  const { events, isLoading: eventsLoading } = useRecentEvents(10);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { isVerified } = useProfile();
  const createModalRef = useFocusTrap<HTMLDivElement>(showCreateModal, () => setShowCreateModal(false));

  // Compute stats
  const totalFunded = invoices.reduce((sum, inv) => sum + inv.fundedAmount, 0n);
  const totalInvoicesCreated = invoices.length;
  const totalListed = invoices.filter(i => i.status === 'Listed').length;
  const totalFundedActive = invoices.filter(i => i.status === 'Funded' || i.status === 'Active' || i.status === 'Confirmed').length;

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatEventDisplay = (event: typeof events[number]) => {
    const typeMap: Record<string, string> = {
      InvoiceCreated: 'Invoice Created',
      create: 'Invoice Created',
      InvoiceListed: 'Invoice Listed',
      list_for_financing: 'Invoice Listed',
      InvoiceFunded: 'Invoice Funded',
      fund_invoice: 'Invoice Funded',
      InvoiceShipped: 'Invoice Shipped',
      mark_shipped: 'Invoice Shipped',
      DeliveryConfirmed: 'Delivery Confirmed',
      confirm_delivery: 'Delivery Confirmed',
      InvoiceRepaid: 'Invoice Repaid',
      repay: 'Invoice Repaid',
      InvoiceDefaulted: 'Invoice Defaulted',
      trigger_default: 'Invoice Defaulted',
    };
    const type = typeMap[event.event_type] || event.event_type;
    const invId: string = event.data?.invoice_id || '';
    const invShort = invId ? `INV#${invId.slice(0, 4)}...` : '';
    let details = '';
    switch (event.event_type) {
      case 'InvoiceCreated':
      case 'create':
        details = `${invShort} created for buyer ${event.data?.buyer ? `${event.data.buyer.slice(0, 4)}...` : 'unknown'}`;
        break;
      case 'InvoiceListed':
      case 'list_for_financing':
        details = `${invShort} listed for financing`;
        break;
      case 'InvoiceFunded':
      case 'fund_invoice':
        details = `${invShort} funded`;
        break;
      case 'InvoiceShipped':
      case 'mark_shipped':
        details = `${invShort} marked as shipped`;
        break;
      case 'DeliveryConfirmed':
      case 'confirm_delivery':
        details = `Buyer confirmed delivery for ${invShort}`;
        break;
      case 'InvoiceRepaid':
      case 'repay':
        details = `${invShort} repaid`;
        break;
      case 'InvoiceDefaulted':
      case 'trigger_default':
        details = `${invShort} defaulted`;
        break;
      default:
        details = invShort || 'Event occurred';
    }
    const now = Math.floor(Date.now() / 1000);
    const diff = now - event.ledger_closed_at;
    let time = '';
    if (diff < 60) time = 'just now';
    else if (diff < 3600) time = `${Math.floor(diff / 60)} min ago`;
    else if (diff < 86400) time = `${Math.floor(diff / 3600)}h ago`;
    else time = `${Math.floor(diff / 86400)}d ago`;
    return { id: event.id, type, details, time };
  };

  if (!connected) {
    return (
      <PageLayout>
        <div className="flex flex-col items-center justify-center text-center py-20 max-w-md mx-auto min-h-[70vh]">
          <div className="bg-primary/10 border border-primary/20 p-4 rounded-lg mb-6 shadow-[0_0_20px_rgba(0,212,170,0.15)]">
            <Layers className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-2xl font-bold font-mono tracking-wider text-white uppercase mb-2">Connect Your Wallet</h1>
          <p className="text-slate-400 text-xs font-mono mb-8 leading-relaxed">
            Connect your Freighter wallet to access the SME Financing Dashboard, issue invoices, and request immediate liquidity.
          </p>
          <WalletConnect />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="space-y-8 py-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/40 pb-5">
          <div>
            <h1 className="text-xl font-bold font-mono tracking-wider uppercase text-white">SME Financing Dashboard</h1>
            <p className="text-slate-500 text-xs font-mono mt-1">
              OPERATOR: {address && formatAddress(address)} | ROLE: {role.toUpperCase()}
            </p>
          </div>
          
          <button
            onClick={() => {
              if (!isVerified) return;
              setShowCreateModal(true);
            }}
            disabled={!isVerified}
            className={`font-bold uppercase tracking-wider text-xs rounded px-4 py-2.5 flex items-center gap-1.5 transition-all ${
              isVerified
                ? 'bg-primary hover:bg-primary-hover text-black shadow-[0_0_15px_rgba(0,212,170,0.1)]'
                : 'bg-neutral-800 text-slate-500 border border-neutral-700 cursor-not-allowed opacity-60'
            }`}
            title={!isVerified ? 'Verification required to create invoices' : undefined}
          >
            <Plus className="w-4 h-4" />
            <span>Create Invoice</span>
          </button>
        </div>

        {/* Warning Banner for Unverified Profiles */}
        {!isVerified && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-start gap-3 font-mono text-xs text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.02)]">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold uppercase">Profile Verification Required</span>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                Your connected wallet address is not verified on-chain. Go to the <Link href="/profile" className="text-primary hover:underline font-bold">[Profile Page]</Link> to register your business credentials and unlock dashboard operations.
              </p>
            </div>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-card border border-border rounded-lg p-4 font-mono">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Created</span>
            <span className="text-lg font-bold text-white block mt-1">{totalInvoicesCreated}</span>
            <span className="text-[9px] text-slate-600">Total trade files</span>
          </div>
          
          <div className="bg-card border border-border rounded-lg p-4 font-mono">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Currently Listed</span>
            <span className="text-lg font-bold text-primary block mt-1">{totalListed}</span>
            <span className="text-[9px] text-slate-600">Awaiting financing</span>
          </div>

                <div className="bg-card border border-border rounded-lg p-4 font-mono">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Funded & Active</span>
                  <span className="text-lg font-bold text-sky-400 block mt-1">{totalFundedActive}</span>
                  <span className="text-[9px] text-slate-600">Liquidity deployed on-chain</span>
                </div>

          <div className="bg-card border border-border rounded-lg p-4 font-mono">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Total Repaid</span>
            <span className="text-lg font-bold text-emerald-400 block mt-1">
              {invoices.filter(i => i.status === 'Repaid').length}
            </span>
            <span className="text-[9px] text-slate-600">Settle invoices</span>
          </div>

            <div className="bg-card border border-border rounded-lg p-4 col-span-2 lg:col-span-1 font-mono">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Total Financed</span>
              <span className="text-lg font-bold text-white block mt-1 truncate">{formatAmount(totalFunded)}</span>
              <span className="text-[9px] text-slate-600">Liquidity captured</span>
            </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Invoices Section (Left / Center) */}
          <div className="lg:col-span-8 space-y-6">
            <h2 className="text-sm font-bold font-mono tracking-wider uppercase text-white">Issued Invoices</h2>

            {isLoading ? (
              <InvoiceTableSkeleton />
            ) : (
              <InvoiceTable 
                invoices={invoices} 
                onSelectInvoice={(invoice) => setSelectedInvoice(invoice)}
                activeId={selectedInvoice?.id}
                emptyState={
                  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                    <p className="text-slate-500 text-xs font-mono mb-6 leading-relaxed max-w-xs">
                      Create your first invoice to get started
                    </p>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="bg-primary hover:bg-primary-hover text-black font-bold uppercase tracking-wider text-xs rounded px-4 py-2.5 flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,212,170,0.1)] transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      Create Invoice
                    </button>
                  </div>
                }
              />
            )}

            {/* Recent activity timeline */}
            {eventsLoading ? (
              <ActivityTimelineSkeleton />
            ) : (
            <div className="bg-card border border-border rounded-lg p-5 space-y-4">
              <h3 className="text-xs font-bold font-mono text-white uppercase tracking-wider border-b border-border/40 pb-2">
                On-Chain Activity Logs
              </h3>
              <div className="space-y-3 font-mono text-xs">
                {events.length === 0 && (
                  <p className="text-slate-500 text-[10px] py-4 text-center">No events recorded yet.</p>
                )}
                {events.map((event) => {
                  const display = formatEventDisplay(event);
                  return (
                    <div key={event.id} className="flex justify-between items-start gap-4 p-2 border-b border-border/20 last:border-0">
                      <div className="space-y-1">
                        <span className="text-primary font-bold">{display.type}</span>
                        <p className="text-[10px] text-slate-400">{display.details}</p>
                      </div>
                      <span className="text-[9px] text-slate-500 text-right">{display.time}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            )}
          </div>

          {/* Side Management Panel (Right) */}
          <div className="lg:col-span-4 space-y-6">
            <h2 className="text-sm font-bold font-mono tracking-wider uppercase text-white">Management console</h2>

            <AnimatePresence mode="wait">
              {selectedInvoice ? (
                <motion.div
                  key={selectedInvoice.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold font-mono text-slate-500 uppercase">Selected invoice details</span>
                    <button 
                      onClick={() => setSelectedInvoice(null)}
                      className="text-[10px] font-mono text-primary hover:underline uppercase font-bold"
                    >
                      Clear console
                    </button>
                  </div>
                  <InvoiceCard invoice={selectedInvoice} role={role} isSelected />
                  
                  {/* Additional invoice details */}
                  <Link
                    href={`/invoice/${selectedInvoice.id}`}
                    className="w-full bg-[#0d131a] border border-border hover:border-primary/50 text-slate-300 hover:text-white font-bold text-xs uppercase tracking-wider py-2 rounded text-center block font-mono"
                  >
                    View audit ledger
                  </Link>
                </motion.div>
              ) : (
                <div className="bg-card/45 border border-dashed border-border rounded-lg p-6 text-center text-slate-500 font-mono text-[10px] py-20 uppercase tracking-wider">
                  Select an obligation from the table to load actions in the operator console.
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Create Invoice Dialog Modal */}
      {showCreateModal && (
        <div
          ref={createModalRef}
          role="dialog"
          aria-modal="true"
          aria-label="Create Invoice"
          tabIndex={-1}
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-[#080c10]/95 backdrop-blur-sm p-0 md:p-4"
        >
          <div
            className="w-full max-w-lg relative bg-card border md:border-border rounded-t-2xl md:rounded-lg max-h-[92vh] md:max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-border/40 shrink-0">
              <span className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider">New Invoice</span>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-500 hover:text-white font-bold font-mono text-xs uppercase px-2 py-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                [Close Esc]
              </button>
            </div>
            <div className="overflow-y-auto overscroll-contain p-5 pt-3">
              <InvoiceForm onSuccess={() => {
                setShowCreateModal(false);
                setSelectedInvoice(null);
              }} />
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
