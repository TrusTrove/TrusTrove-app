"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletConnect } from "./WalletConnect";
import { SkeletonShimmer } from "./SkeletonLoader";
import { useWalletStore } from "@/store/wallet";
import { useBalances } from "@/hooks/useBalances";
import { useProfile } from "@/hooks/useProfile";
import { Wallet, Shield, Terminal, ExternalLink, Menu, X } from "lucide-react";

const ROLES = ["issuer", "buyer", "lp"] as const;
type Role = (typeof ROLES)[number];

function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function Navbar() {
  const pathname = usePathname();
  const role = useWalletStore((s) => s.role);
  const setRole = useWalletStore((s) => s.setRole);
  const connected = useWalletStore((s) => s.connected);
  const { balances, loading: balancesLoading } = useBalances();
  const { isVerified } = useProfile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { name: "SME Dashboard", href: "/dashboard" },
    { name: "LP Portal", href: "/lp" },
    { name: "Marketplace", href: "/marketplace" },
    { name: "Profile", href: "/profile" },
  ];

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="flex items-center gap-2 hover:opacity-95 transition-opacity"
              onClick={closeMobileMenu}
            >
              <div className="bg-primary/15 border border-primary/30 p-2 rounded-lg text-primary shadow-[0_0_12px_rgba(0,212,170,0.15)]">
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
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold font-mono tracking-wider uppercase transition-all duration-200 border flex items-center gap-1.5 ${
                      isActive
                        ? "bg-primary/10 border-primary/30 text-primary shadow-[0_0_10px_rgba(0,212,170,0.1)]"
                        : "border-transparent text-slate-400 hover:text-white hover:bg-slate-900/50"
                    }`}
                  >
                    <span>{item.name}</span>
                    {item.name === "Profile" && connected && isVerified && (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"
                        title="Verified Profile"
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-4">
            {connected && (
              <>
                {/* Balances */}
                <div className="hidden md:flex items-center gap-3 bg-neutral-900/90 border border-border/80 rounded-lg px-3 py-1.5 shadow-inner">
                  <div className="flex items-center gap-1.5 group relative">
                    <Wallet className="w-3.5 h-3.5 text-sky-400" />
                    {balancesLoading ? (
                      <SkeletonShimmer className="h-3.5 w-14" />
                    ) : (
                      <>
                        <span className="text-[11px] font-mono text-slate-200 font-bold">
                          {balances.usdc !== null
                            ? `${parseFloat(balances.usdc).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`
                            : "— USDC"}
                        </span>
                        {(balances.usdc === null ||
                          parseFloat(balances.usdc) === 0) && (
                          <div className="absolute -top-9 left-1/2 -translate-x-1/2 hidden group-hover:block whitespace-nowrap bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-mono px-2.5 py-1 rounded-md shadow-xl z-50">
                            <a
                              href="https://demo.stellar.org"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 hover:underline"
                            >
                              Get testnet USDC <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <div className="h-3 w-[1px] bg-border" />
                  <div className="flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-amber-400" />
                    {balancesLoading ? (
                      <SkeletonShimmer className="h-3.5 w-12" />
                    ) : (
                      <span className="text-[11px] font-mono text-slate-300 font-bold">
                        {balances.xlm !== null
                          ? `${parseFloat(balances.xlm).toLocaleString(undefined, { maximumFractionDigits: 2 })} XLM`
                          : "0 XLM"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Role Switcher */}
                <div className="hidden lg:flex items-center gap-1.5 bg-neutral-900/90 border border-border/80 rounded-lg px-2 py-1 shadow-inner">
                  <Shield className="w-3.5 h-3.5 text-primary ml-1" />
                  <select
                    value={role}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (isRole(val)) {
                        setRole(val);
                      }
                    }}
                    className="bg-transparent text-[11px] font-mono text-slate-200 font-bold uppercase tracking-wider focus:outline-none cursor-pointer py-0.5 pr-1"
                    aria-label="Select role"
                  >
                    <option value="issuer" className="bg-neutral-900 text-slate-200">
                      Issuer
                    </option>
                    <option value="buyer" className="bg-neutral-900 text-slate-200">
                      Buyer
                    </option>
                    <option value="lp" className="bg-neutral-900 text-slate-200">
                      LP
                    </option>
                  </select>
                </div>
              </>
            )}

            <div className="hidden sm:block">
              <WalletConnect />
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg bg-neutral-900 border border-border text-slate-300 hover:text-white"
              aria-label="Toggle mobile menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-[#080c10]/95 px-4 pt-3 pb-5 space-y-4 shadow-2xl backdrop-blur-xl">
          {connected && (
            <div className="space-y-3 pb-3 border-b border-border/50">
              <div className="flex items-center justify-between bg-neutral-900/90 border border-border/80 rounded-lg p-2.5">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-sky-400" />
                  <span className="text-xs font-mono text-slate-200 font-bold">
                    {balances.usdc !== null
                      ? `${parseFloat(balances.usdc).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`
                      : "— USDC"}
                  </span>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  {balances.xlm !== null
                    ? `${parseFloat(balances.xlm).toLocaleString(undefined, { maximumFractionDigits: 2 })} XLM`
                    : "— XLM"}
                </span>
              </div>

              <div className="flex items-center justify-between bg-neutral-900/90 border border-border/80 rounded-lg p-2.5">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <span className="text-xs font-mono text-slate-300 uppercase tracking-wider">
                    Active Role
                  </span>
                </div>
                <select
                  value={role}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (isRole(val)) {
                      setRole(val);
                    }
                  }}
                  className="bg-neutral-800 border border-border rounded px-2 py-1 text-xs font-mono text-slate-200 font-bold uppercase tracking-wider focus:outline-none"
                  aria-label="Select role (mobile)"
                >
                  <option value="issuer">Issuer</option>
                  <option value="buyer">Buyer</option>
                  <option value="lp">LP</option>
                </select>
              </div>
            </div>
          )}

          <div className="flex flex-col space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMobileMenu}
                  className={`px-3.5 py-2.5 rounded-lg text-xs font-bold font-mono tracking-wider uppercase transition-all duration-200 border flex items-center justify-between ${
                    isActive
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "border-transparent text-slate-400 hover:text-white hover:bg-slate-900/50"
                  }`}
                >
                  <span>{item.name}</span>
                  {item.name === "Profile" && connected && isVerified && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                  )}
                </Link>
              );
            })}
          </div>

          <div className="mt-4 sm:hidden">
            <WalletConnect />
          </div>
        </div>
      )}
    </nav>
  );
}
