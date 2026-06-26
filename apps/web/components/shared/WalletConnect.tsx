'use client';

import React, { useState, useEffect } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { Button } from '@/components/ui/button';
import { isFreighterInstalled } from '@/lib/freighter';
import { useWalletStore } from '@/store/wallet';
import { Wallet, LogOut, AlertCircle, Loader2, Copy, Check, ExternalLink } from 'lucide-react';

export function WalletConnect() {
  const {
    address,
    connected,
    connectWallet,
    disconnectWallet,
    loading,
    error: walletError,
  } = useWallet();
  
  const { network } = useWalletStore();
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    isFreighterInstalled().then(setInstalled);
  }, []);

  const handleCopy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // If Freighter is not installed
  if (installed === false) {
    return (
      <a
        href="https://www.freighter.app/"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/20 transition-all font-mono"
      >
        <span>Install Freighter</span>
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
    );
  }

  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center">
      {/* Network Badge */}
      {connected && (
        <div className="flex items-center gap-2">
          {network === 'testnet' ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Testnet
            </span>
          ) : network === 'mainnet' ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Mainnet
            </span>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10 rounded-md font-mono"
              onClick={connectWallet}
            >
              Switch to Testnet
            </Button>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        {connected && address ? (
          <div className="flex items-center gap-2 bg-neutral-900 border border-border rounded-lg pl-3 pr-1 py-1 transition-all duration-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold font-mono text-slate-300">
              {formatAddress(address)}
            </span>
            
            <button
              onClick={handleCopy}
              className="p-1.5 text-slate-500 hover:text-teal-400 transition-colors"
              title="Copy Address"
              aria-label="Copy wallet address"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
            
            <div className="w-px h-4 bg-border mx-1" />
            
            <button
              className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
              onClick={disconnectWallet}
              title="Disconnect Wallet"
              aria-label="Disconnect wallet"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <Button
            onClick={connectWallet}
            disabled={loading}
            className="bg-primary hover:bg-primary-hover text-black font-bold transition-all duration-200 flex items-center gap-2 rounded-lg px-4 py-2 shadow-[0_0_15px_rgba(0,212,170,0.15)]"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wallet className="h-4 w-4" />
            )}
            <span>{loading ? 'CONNECTING...' : 'CONNECT WALLET'}</span>
          </Button>
        )}
      </div>

      {walletError && (
        <div className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-md px-2.5 py-1">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate max-w-xs">{walletError}</span>
        </div>
      )}
    </div>
  );
}
