'use client';

import React, { useState } from 'react';
import { Invoice } from '@/types';
import { InvoiceStatus } from './InvoiceStatus';
import { useInvoices } from '@/hooks/useInvoices';
import { Button } from '@/components/ui/button';
import { useWalletStore } from '@/store/wallet';
import { useProfile } from '@/hooks/useProfile';
import { motion } from 'framer-motion';
import { Calendar, ShieldAlert, Copy, Check, Truck, Landmark, Wallet, CheckSquare, Clock, X } from 'lucide-react';
import { formatAmount } from '@/lib/assets';


interface InvoiceCardProps {
  invoice: Invoice;
  role?: 'issuer' | 'buyer' | 'lp';
  onSelect?: () => void;
  isSelected?: boolean;
}

interface PendingAction {
  label: string;
  fn: () => Promise<any>;
  errorMsg: string;
}

export function InvoiceCard({ invoice, role, onSelect, isSelected }: InvoiceCardProps) {
  const { address } = useWalletStore();
  const { isVerified } = useProfile();
  const { listInvoice, fundInvoice, shipInvoice, confirmDelivery, repayInvoice, defaultInvoice } = useInvoices();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedBuyer, setCopiedBuyer] = useState(false);
  const [discountBpsInput, setDiscountBpsInput] = useState('200'); // default 2%
  const [showListForm, setShowListForm] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const truncateAddr = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const copyToClipboard = async (text: string, type: 'id' | 'buyer') => {
    await navigator.clipboard.writeText(text);
    if (type === 'id') {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } else {
      setCopiedBuyer(true);
      setTimeout(() => setCopiedBuyer(false), 2000);
    }
  };

  const handleList = async () => {
    setLoading(true);
    setError(null);
    try {
      const bps = parseInt(discountBpsInput, 10);
      if (isNaN(bps) || bps <= 0 || bps > 10000) {
        throw new Error('Discount basis points must be between 1 and 10,000 (100%)');
      }
      await listInvoice({ invoiceId: invoice.id, discountBps: bps });
      setShowListForm(false);
    } catch (err: any) {
      setError(err.message || 'Failed to list invoice');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (actionFn: () => Promise<any>, errorMsg: string) => {
    setLoading(true);
    setError(null);
    try {
      await actionFn();
    } catch (err: any) {
      setError(err.message || errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Opens the confirmation dialog instead of firing the on-chain action directly.
  // The actual call only happens if the user hits Confirm in the dialog.
  const requestConfirmation = (action: PendingAction) => {
    setPendingAction(action);
  };

  const handleConfirm = async () => {
    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);
    await handleAction(action.fn, action.errorMsg);
  };

  const handleCancelConfirmation = () => {
    setPendingAction(null);
  };

  // Due date calculation
  const nowSecs = Math.floor(Date.now() / 1000);
  const secondsRemaining = Number(invoice.dueDate) - nowSecs;
  const daysRemaining = Math.ceil(secondsRemaining / (24 * 3600));
  const isOverdue = secondsRemaining < 0;

  const showActions = !!address;

  // Render actions depending on state
  return (
    <motion.div
      onClick={onSelect}
      whileHover={{ y: -2 }}
      className={`relative overflow-hidden bg-card border transition-all duration-300 rounded-lg p-5 cursor-pointer ${
        isSelected
          ? 'border-primary shadow-[0_0_24px_rgba(0,212,170,0.15)] bg-[#0d131a]'
          : 'border-border hover:border-primary/50 hover:shadow-[0_0_24px_rgba(0,212,170,0.15)]'
      }`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-slate-500 font-bold">INV#{truncateAddr(invoice.id)}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                copyToClipboard(invoice.id, 'id');
              }}
              className="text-slate-600 hover:text-primary transition-colors p-0.5"
              aria-label="Copy invoice ID"
            >
              {copiedId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
          <h3 className="text-sm font-bold text-slate-400 font-mono">Invoice obligation</h3>
        </div>
        <InvoiceStatus status={invoice.status} />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block">Face Value</span>
          <span className="text-lg font-bold font-mono text-white">
            {formatAmount(invoice.faceValue, invoice.asset)}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block">Discount Rate</span>
          <span className="text-lg font-bold font-mono text-primary">
            {invoice.discountBps > 0 ? `${(invoice.discountBps / 100).toFixed(2)}%` : '—'}
          </span>
        </div>
      </div>

      <div className="space-y-2 border-t border-border/40 pt-3 mb-4 text-xs font-mono">
        <div className="flex justify-between items-center">
          <span className="text-slate-500">Buyer Address:</span>
          <div className="flex items-center gap-1">
            <span className="text-slate-300" title={invoice.buyer}>{truncateAddr(invoice.buyer)}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                copyToClipboard(invoice.buyer, 'buyer');
              }}
              className="text-slate-600 hover:text-primary transition-colors"
              aria-label="Copy buyer address"
            >
              {copiedBuyer ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-slate-500 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-600" /> Due Date:
          </span>
          <span className="text-slate-300">
            {new Date(invoice.dueDate * 1000).toLocaleDateString()}
          </span>
        </div>

        {/* Urgency signal: Days remaining */}
        {invoice.status !== 'Repaid' && invoice.status !== 'Defaulted' && (
          <div className="flex justify-between items-center bg-[#080c10]/40 p-2 rounded border border-border/20 mt-1">
            <span className="text-slate-500 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-600" /> Due Status:
            </span>
            <span className={`text-xs font-bold font-mono ${isOverdue ? 'text-amber-500 animate-pulse' : 'text-slate-300'}`}>
              {isOverdue ? (
                'OVERDUE'
              ) : (
                <span>{daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining</span>
              )}
            </span>
          </div>
        )}
      </div>

      {invoice.status !== 'Created' && invoice.status !== 'Listed' && (
        <div className="bg-[#080c10] rounded border border-border/30 p-2.5 mb-4 text-[10px] font-mono space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500">Funded liquidity:</span>
            <span className="font-bold text-sky-400">{formatAmount(invoice.fundedAmount, invoice.asset)}</span>
          </div>
          {invoice.fundedAt && (
            <div className="flex justify-between">
              <span className="text-slate-500">Liquidity timestamp:</span>
              <span className="text-slate-400">{new Date(invoice.fundedAt * 1000).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="font-mono">{error}</span>
        </div>
      )}

      {showActions && (
        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
          {!isVerified && (
            <div className="p-2 border border-amber-500/20 bg-amber-500/5 text-amber-500 text-[9px] font-mono rounded flex items-start gap-1.5 mb-2 leading-normal">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>Verification required to execute smart contract operations.</span>
            </div>
          )}

          {invoice.status === 'Created' && role === 'issuer' && !showListForm && (
            <Button
              className={`w-full font-bold uppercase tracking-wider text-xs rounded py-2 transition-all ${
                isVerified
                  ? 'bg-primary hover:bg-primary-hover text-black shadow-[0_0_15px_rgba(0,212,170,0.1)]'
                  : 'bg-neutral-800 text-slate-500 border border-neutral-700 cursor-not-allowed opacity-60'
              }`}
              onClick={() => {
                if (!isVerified) return;
                setShowListForm(true);
              }}
              disabled={loading || !isVerified}
            >
              Configure financing terms
            </Button>
          )}

          {showListForm && (
            <div className="bg-[#080c10] p-3 border border-border rounded space-y-3">
              <div>
                <label className="block text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider mb-1">
                  Discount Basis Points (e.g. 200 = 2.00%)
                </label>
                <input
                  type="number"
                  className="w-full bg-slate-900 border border-border rounded px-3 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-primary"
                  value={discountBpsInput}
                  onChange={(e) => setDiscountBpsInput(e.target.value)}
                  disabled={!isVerified}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1 border border-border bg-transparent hover:bg-slate-900 text-slate-300 text-[10px] font-bold uppercase py-1"
                  onClick={() => setShowListForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  className={`flex-1 font-bold uppercase text-[10px] py-1 ${
                    isVerified
                      ? 'bg-primary hover:bg-primary-hover text-black'
                      : 'bg-neutral-800 text-slate-500 border border-neutral-700 cursor-not-allowed opacity-60'
                  }`}
                  onClick={handleList}
                  disabled={loading || !isVerified}
                >
                  {loading ? 'SUBMITTING...' : 'LIST TERMS'}
                </Button>
              </div>
            </div>
          )}

          {invoice.status === 'Listed' && role === 'lp' && (
            <Button
              className={`w-full font-bold uppercase tracking-wider text-xs rounded py-2 flex items-center justify-center gap-1.5 transition-all ${
                isVerified
                  ? 'bg-secondary hover:bg-secondary/90 text-white'
                  : 'bg-neutral-800 text-slate-500 border border-neutral-700 cursor-not-allowed opacity-60'
              }`}
              onClick={() => {
                if (!isVerified) return;
                handleAction(() => fundInvoice({ invoiceId: invoice.id }), 'Failed to fund invoice');
              }}
              disabled={loading || !isVerified}
            >
              <Landmark className="w-3.5 h-3.5" />
              {loading ? 'FUNDING ON-CHAIN...' : 'FUND INVOICE'}
            </Button>
          )}

          {invoice.status === 'Funded' && role === 'issuer' && (
            <Button
              className={`w-full font-bold uppercase tracking-wider text-xs rounded py-2 flex items-center justify-center gap-1.5 transition-all ${
                isVerified
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  : 'bg-neutral-800 text-slate-500 border border-neutral-700 cursor-not-allowed opacity-60'
              }`}
              onClick={() => {
                if (!isVerified) return;
                handleAction(() => shipInvoice({ invoiceId: invoice.id }), 'Failed to mark as shipped');
              }}
              disabled={loading || !isVerified}
            >
              <Truck className="w-3.5 h-3.5" />
              {loading ? 'SHIPPING...' : 'MARK GOODS SHIPPED'}
            </Button>
          )}

          {invoice.status === 'Active' && role === 'buyer' && !invoice.buyerConfirmed && (
            <Button
              className={`w-full font-bold uppercase tracking-wider text-xs rounded py-2 flex items-center justify-center gap-1.5 transition-all ${
                isVerified
                  ? 'bg-sky-600 hover:bg-sky-500 text-white'
                  : 'bg-neutral-800 text-slate-500 border border-neutral-700 cursor-not-allowed opacity-60'
              }`}
              onClick={() => {
                if (!isVerified) return;
                requestConfirmation({
                  label: 'Confirm Delivery',
                  fn: () => confirmDelivery({ invoiceId: invoice.id }),
                  errorMsg: 'Failed to confirm delivery',
                });
              }}
              disabled={loading || !isVerified}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              {loading ? 'CONFIRMING...' : 'CONFIRM DELIVERY'}
            </Button>
          )}

{invoice.status === 'Confirmed' && role === 'buyer' && (
             <Button
               className={`w-full font-bold uppercase tracking-wider text-xs rounded py-2 flex items-center justify-center gap-1.5 transition-all ${
                 isVerified
                   ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                   : 'bg-neutral-800 text-slate-500 border border-neutral-700 cursor-not-allowed opacity-60'
               }`}
               onClick={() => {
                 if (!isVerified) return;
                 requestConfirmation({
                   label: 'Repay Invoice',
                   fn: () => repayInvoice({ invoiceId: invoice.id }),
                   errorMsg: 'Failed to repay invoice',
                 });
               }}
               disabled={loading || !isVerified}
             >
               <Wallet className="w-3.5 h-3.5" />
               {loading ? 'REPAYING...' : 'REPAY INVOICE'}
             </Button>
           )}

          {invoice.status === 'Active' && isOverdue && (
            <Button
              className={`w-full font-bold uppercase tracking-wider text-xs rounded py-2 flex items-center justify-center gap-1.5 transition-all ${
                isVerified
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-neutral-800 text-slate-500 border border-neutral-700 cursor-not-allowed opacity-60'
              }`}
              onClick={() => {
                if (!isVerified) return;
                requestConfirmation({
                  label: 'Trigger Default',
                  fn: () => defaultInvoice({ invoiceId: invoice.id }),
                  errorMsg: 'Failed to trigger default',
                });
              }}
              disabled={loading || !isVerified}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              {loading ? 'TRIGGERING DEFAULT...' : 'TRIGGER DEFAULT'}
            </Button>
          )}
        </div>
      )}

      {/* Confirmation dialog for irreversible on-chain actions.
          Rendered once per card; only visible when pendingAction is set. */}
      {pendingAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={(e) => {
            e.stopPropagation();
            handleCancelConfirmation();
          }}
        >
          <div
            className="w-full max-w-sm bg-[#0d131a] border border-border rounded-lg p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <h4 className="text-sm font-bold font-mono text-white uppercase tracking-wider">
                Confirm {pendingAction.label}
              </h4>
              <button
                onClick={handleCancelConfirmation}
                className="text-slate-500 hover:text-slate-300 transition-colors"
                aria-label="Close confirmation dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 mb-5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">Action:</span>
                <span className="text-slate-200">{pendingAction.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice ID:</span>
                <span className="text-slate-200" title={invoice.id}>{truncateAddr(invoice.id)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Estimated Fee:</span>
                <span className="text-slate-200">Network fee applies</span>
              </div>
            </div>

            <p className="text-[10px] text-amber-500/90 font-mono mb-4 leading-normal">
              This action is irreversible once submitted on-chain. Review carefully before confirming.
            </p>

            <div className="flex gap-2">
              <Button
                className="flex-1 border border-border bg-transparent hover:bg-slate-900 text-slate-300 text-[10px] font-bold uppercase py-2"
                onClick={handleCancelConfirmation}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold uppercase py-2"
                onClick={handleConfirm}
                disabled={loading}
              >
                {loading ? 'PROCESSING...' : 'CONFIRM'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
