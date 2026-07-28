'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WalletConnect } from './WalletConnect';
import { SkeletonShimmer } from './SkeletonLoader';
import { useWalletStore } from '@/store/wallet';
import { useBalances } from '@/hooks/useBalances';
import { Wallet, Shield, Terminal, ExternalLink } from 'lucide-react';

type UserRole = 'issuer' | 'buyer' | 'lp';

function isUserRole(value: string): value is UserRole {
  return value === 'issuer' || value === 'buyer' || value === 'lp';
}

export function Navbar() {
  const pathname = usePathname();
  const { role, setRole, connected } = useWalletStore();
  const { balances, loading: balancesLoading } = useBalances();

  const navItems = [
    { name: 'SME Dashboard', href: '/dashboard' },
    { name: 'LP Portal', href: '/lp' },
    { name: 'Marketplace', href: '/marketplace' },
  ];

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 hover:opacity-95 transition-opacity">
              <div className="bg-primary/10 border border-primary/20 p-2 rounded-lg text-primary shadow-[0_0_10px_rgba(0,212,170,0.1)]">
                <Terminal className="w-5 h-5" />
              </div>
              <span className="font-extrabold text-lg tracking-tight font-mono text-white">
                TRUST<span className="text-primary">TROVE</span>
              </span>
            </Link>

            <div className="hidden md:flex space-x-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold font-mono tracking-wider uppercase transition-all duration-200 border ${
                      isActive
                        ? 'bg-primary/5 border-primary/20 text-primary'
                        : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-900/50'
                    }`}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {connected && (
              <>
                {/* Balances */}
                <div className="hidden md:flex items-center gap-3 bg-neutral-900 border border-border rounded-lg px-3 py-1">
                  <div className="flex items-center gap-1.5 group relative">
                    <Wallet className="w-3 h-3 text-sky-400" />
                    {balancesLoading ? (
                      <SkeletonShimmer className="h-3.5 w-14" />
                    ) : (
                      <>
                        <span className="text-[10px] font-mono text-slate-300 font-bold">
                          {balances.usdc !== null
                            ? `${parseFloat(balances.usdc).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`
                            : '— USDC'}
                        </span>
                        {(balances.usdc === null || parseFloat(balances.usdc) === 0) && (
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block whitespace-nowrap bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-mono px-2 py-1 rounded-md shadow-lg z-50">
                            <a href="https://demo.stellar.org" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline">
                              Get testnet USDC <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <div className="w-px h-3 bg-border" />
                  <div className="flex items-center gap-1.5">
                    <Wallet className="w-3 h-3 text-amber-400" />
                    {balancesLoading ? (
                      <SkeletonShimmer className="h-3.5 w-14" />
                    ) : (
                      <span className="text-[10px] font-mono text-slate-300 font-bold">
                        {balances.xlm !== null
                          ? `${parseFloat(balances.xlm).toLocaleString(undefined, { maximumFractionDigits: 2 })} XLM`
                          : '0 XLM'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-neutral-900 border border-border rounded-lg px-2.5 py-1">
                  <Shield className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wider hidden sm:inline">Role:</span>
                  <select
                    value={role}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (isUserRole(value)) {
                        setRole(value);
                      }
                    }}
                    className="bg-transparent text-xs text-white border-none focus:ring-0 focus:outline-none font-bold font-mono cursor-pointer pr-5 py-0"
                  >
                    <option value="issuer" className="bg-[#080c10] text-slate-200">SME (Issuer)</option>
                    <option value="buyer" className="bg-[#080c10] text-slate-200">Buyer</option>
                    <option value="lp" className="bg-[#080c10] text-slate-200">LP (Funder)</option>
                  </select>
                </div>
              </>
            )}

            <WalletConnect />
          </div>
        </div>
      </div>
    </nav>
  );
}
