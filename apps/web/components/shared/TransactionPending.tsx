'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Loader2, ExternalLink, ShieldCheck } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface TransactionPendingProps {
  isOpen: boolean;
  txHash: string | null;
  statusText?: string;
  onClose?: () => void;
}

export function TransactionPending({ isOpen, txHash, statusText = 'Waiting for confirmation...', onClose }: TransactionPendingProps) {
  const overlayRef = useFocusTrap<HTMLDivElement>(isOpen, onClose ?? undefined);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Transaction Pending"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#080c10]/95 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-md bg-card border border-border rounded-lg p-6 flex flex-col items-center justify-center text-center shadow-[0_0_50px_rgba(0,212,170,0.05)]">
        {/* Animated Stellar Orbit Logo */}
        <div className="relative w-28 h-28 flex items-center justify-center mb-6">
          {/* Central Core */}
          <div className="w-12 h-12 rounded-full border border-primary/40 bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          
          {/* Orbital path */}
          <div className="absolute w-24 h-24 rounded-full border border-border/30 border-dashed" />
          
          {/* Orbiting Moon */}
          <motion.div
            className="absolute w-3 h-3 rounded-full bg-primary"
            animate={{
              rotate: 360,
            }}
            transition={{
              repeat: Infinity,
              duration: 4,
              ease: 'linear',
            }}
            style={{
              originX: '50%',
              originY: '50%',
              width: '96px', // spans outer bounds
              height: '12px',
            }}
          />
        </div>

        <h3 className="text-md font-bold font-mono tracking-wider text-white uppercase mb-2">
          TRANSACTION SIGNED
        </h3>
        <p className="text-slate-400 text-xs font-mono mb-6 flex items-center gap-1.5 justify-center">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
          {statusText}
        </p>

        {txHash && (
          <div className="w-full bg-[#080c10] border border-border/40 rounded p-3 text-left font-mono text-[10px] space-y-2 mb-6">
            <div className="flex justify-between text-slate-500 font-bold uppercase tracking-wider">
              <span>TX HASH</span>
              <span className="text-primary">TESTNET</span>
            </div>
            <div className="text-slate-300 break-all bg-slate-950/50 p-2 border border-border/20 rounded select-all">
              {txHash}
            </div>
            <a
              href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline hover:text-primary-hover font-bold"
            >
              <span>VIEW ON STELLAR EXPERT</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {onClose && (
          <Button
            className="w-full bg-slate-900 border border-border text-slate-300 font-bold text-xs uppercase py-2 hover:bg-slate-800"
            onClick={onClose}
          >
            Close Dialog
          </Button>
        )}
      </div>
    </div>
  );
}

// Simple button helper to bypass standard UI import issues
function Button({ children, className, onClick }: { children: React.ReactNode; className: string; onClick?: () => void }) {
  return (
    <button className={className} onClick={onClick}>
      {children}
    </button>
  );
}
