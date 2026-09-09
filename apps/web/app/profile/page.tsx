"use client";

import React, { useState } from "react";
import { PageLayout } from "@/components/shared/PageLayout";
import { useWalletStore } from "@/store/wallet";
import { useProfile } from "@/hooks/useProfile";
import { WalletConnect } from "@/components/shared/WalletConnect";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { RegistrationModal } from "@/components/profile/RegistrationModal";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  ShieldAlert,
  Building2,
  Calendar,
  UserCheck,
  FileBadge2,
  Building,
  Fingerprint,
} from "lucide-react";
import { truncateAddress } from "@/lib/format";

const registryContractID = process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID || "";

export default function ProfilePage() {
  const connected = useWalletStore((s) => s.connected);
  const address = useWalletStore((s) => s.address);
  const {
    profile,
    isProfileLoading,
    isVerified,
    isVerifiedLoading,
    register,
    isRegistering,
    registerError,
  } = useProfile();

  // Registration Form State
  const [showRegModal, setShowRegModal] = useState(false);

  if (!connected) {
    return (
      <PageLayout>
        <div className="flex flex-col items-center justify-center text-center py-20 max-w-md mx-auto min-h-[70vh]">
          <div className="bg-primary/10 border border-primary/20 p-4 rounded-lg mb-6 shadow-[0_0_20px_rgba(0,212,170,0.15)]">
            <Building2 className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-2xl font-bold font-mono tracking-wider text-white uppercase mb-2">
            Connect Your Wallet
          </h1>
          <p className="text-slate-400 text-xs font-mono mb-8 leading-relaxed">
            Connect your Freighter wallet to check your on-chain verification
            credentials, register a new business profile, or update your
            metadata.
          </p>
          <WalletConnect />
        </div>
      </PageLayout>
    );
  }

  const isLoading = isProfileLoading || isVerifiedLoading;

  return (
    <PageLayout>
      <div className="space-y-8 py-4 max-w-4xl mx-auto">
        {/* Header */}
        <div className="border-b border-border/40 pb-5">
          <h1 className="text-xl font-bold font-mono tracking-wider uppercase text-white">
            Business profile & Verification
          </h1>
          <p className="text-slate-500 text-xs font-mono mt-1">
            Manage your on-chain corporate credentials and verification states
            on the TrusTrove Registry contract.
          </p>
        </div>

        <ErrorBoundary context="ProfileContent">
          {isLoading ? (
            <div className="bg-[#0d131a] border border-border rounded-lg p-12 flex flex-col items-center justify-center space-y-4 font-mono text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
              <span className="text-slate-400 uppercase tracking-widest animate-pulse">
                Syncing credential ledger...
              </span>
            </div>
          ) : isVerified && profile ? (
            /* VERIFIED STATE */
            <div className="space-y-6">
              <div className="bg-card border border-primary/30 rounded-lg p-6 md:p-8 shadow-[0_0_30px_rgba(0,212,170,0.06)] relative overflow-hidden">
                {/* Scanline element */}
                <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,212,170,0.03)_1px,transparent_1px)] bg-[size:100%_4px] pointer-events-none" />

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                  <div className="flex items-start gap-4">
                    <div className="bg-primary/10 border border-primary/30 p-3.5 rounded-lg text-primary shadow-[0_0_15px_rgba(0,212,170,0.15)] shrink-0">
                      <ShieldCheck className="w-8 h-8" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[10px] font-bold font-mono tracking-widest uppercase rounded">
                          VERIFIED ON-CHAIN
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold font-mono tracking-widest uppercase rounded">
                          ROLE: {profile.role.toUpperCase()}
                        </span>
                      </div>
                      <h2 className="text-lg font-bold text-white font-mono uppercase">
                        Decentralized Identity Active
                      </h2>
                      <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
                        Your business wallet is fully whitelisted in the
                        Registry contract. All trading, invoice creation, and
                        funding pipelines are unlocked.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 pt-8 border-t border-border/40 font-mono text-xs relative z-10">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2.5">
                      <Fingerprint className="w-4 h-4 text-slate-500" />
                      <div>
                        <span className="text-[10px] text-slate-500 font-bold uppercase block">
                          Whitelisted Address
                        </span>
                        <span className="text-white block mt-0.5 select-all break-all">
                          {profile.address}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <Building className="w-4 h-4 text-slate-500" />
                      <div>
                        <span className="text-[10px] text-slate-500 font-bold uppercase block">
                          Registry Role
                        </span>
                        <span className="text-primary font-bold block mt-0.5 uppercase">
                          {profile.role === "issuer"
                            ? "SME / Invoice Issuer"
                            : "Obligor / Buyer"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2.5">
                      <Calendar className="w-4 h-4 text-slate-500" />
                      <div>
                        <span className="text-[10px] text-slate-500 font-bold uppercase block">
                          Registered Timestamp
                        </span>
                        <span className="text-slate-300 block mt-0.5">
                          {profile.registeredAt > 0
                            ? new Date(
                                profile.registeredAt * 1000,
                              ).toLocaleString()
                            : "Genesis Sync"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <FileBadge2 className="w-4 h-4 text-slate-500" />
                      <div>
                        <span className="text-[10px] text-slate-500 font-bold uppercase block">
                          Contract Registry Hook
                        </span>
                        <span className="text-slate-400 block mt-0.5 break-all">
                          {registryContractID}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-[#080c10] border border-border p-5 rounded-lg space-y-2 font-mono text-xs text-slate-500 leading-normal">
                <span className="text-primary font-bold block uppercase text-[10px] tracking-wider mb-1">
                  On-Chain Governance Note
                </span>
                SME and Buyer profiles verified through the Registry smart
                contract cannot modify their roles directly. To revoke
                verification or assign alternative configurations, reach out to
                the contract administrator.
              </div>
            </div>
          ) : (
            /* UNVERIFIED STATE */
            <div className="space-y-6">
              <div className="bg-card border border-amber-500/20 rounded-lg p-6 md:p-8 shadow-[0_0_30px_rgba(245,158,11,0.02)] relative overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-start gap-4">
                    <div className="bg-amber-500/10 border border-amber-500/25 p-3.5 rounded-lg text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.1)] shrink-0">
                      <ShieldAlert className="w-8 h-8" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold font-mono tracking-widest uppercase rounded">
                          UNVERIFIED / UNREGISTERED
                        </span>
                      </div>
                      <h2 className="text-lg font-bold text-white font-mono uppercase">
                        Profile Verification Required
                      </h2>
                      <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
                        Your connected address{" "}
                        <strong className="text-white font-mono">
                          {address && truncateAddress(address)}
                        </strong>{" "}
                        is not registered. You cannot create invoices, deploy
                        liquidity, or interact with pool escrows until you
                        register your credentials.
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <Button
                      onClick={() => setShowRegModal(true)}
                      className="bg-primary hover:bg-primary-hover text-black font-bold uppercase tracking-wider text-xs rounded px-5 py-3 flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,212,170,0.15)] transition-all font-mono"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Register profile</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Explanatory cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-card border border-border p-6 rounded-lg space-y-3 font-mono text-xs">
                  <h4 className="text-white font-bold uppercase flex items-center gap-2 border-b border-border/40 pb-2">
                    <Building className="w-4 h-4 text-primary" />
                    SME / Invoice Issuer
                  </h4>
                  <p className="text-slate-400 leading-relaxed">
                    For businesses looking to capture liquidity. Registering as
                    an Issuer allows you to tokenize accounts receivable
                    obligations, list them at discounting rates, and request
                    pool financing.
                  </p>
                </div>

                <div className="bg-card border border-border p-6 rounded-lg space-y-3 font-mono text-xs">
                  <h4 className="text-white font-bold uppercase flex items-center gap-2 border-b border-border/40 pb-2">
                    <UserCheck className="w-4 h-4 text-sky-400" />
                    Obligor / Buyer
                  </h4>
                  <p className="text-slate-400 leading-relaxed">
                    For commercial counterparties. Registering as a Buyer
                    whitelists your wallet to authorize and settle tokenized
                    invoice obligations on maturity terms.
                  </p>
                </div>
              </div>
            </div>
          )}
        </ErrorBoundary>
      </div>

      <RegistrationModal
        isOpen={showRegModal}
        onClose={() => setShowRegModal(false)}
        register={register}
        isRegistering={isRegistering}
        registerError={registerError}
      />
    </PageLayout>
  );
}
