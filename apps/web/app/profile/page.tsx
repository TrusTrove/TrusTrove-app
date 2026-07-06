"use client";

import React, { useState } from "react";
import { PageLayout } from "@/components/shared/PageLayout";
import { useWalletStore } from "@/store/wallet";
import { useProfile } from "@/hooks/useProfile";
import { WalletConnect } from "@/components/shared/WalletConnect";
import { TransactionPending } from "@/components/shared/TransactionPending";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  ShieldAlert,
  Building2,
  Globe,
  FileText,
  Calendar,
  Lock,
  UserCheck,
  FileBadge2,
  Building,
  Mail,
  Fingerprint,
} from "lucide-react";

const registryContractID = process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID || "";

export default function ProfilePage() {
  const { connected, address } = useWalletStore();
  const {
    profile,
    isProfileLoading,
    isVerified,
    isVerifiedLoading,
    register,
    isRegistering,
    registerError,
  } = useProfile();

  // Registration Form States
  const [showRegModal, setShowRegModal] = useState(false);
  const [regRole, setRegRole] = useState<"issuer" | "buyer">("issuer");
  const [companyName, setCompanyName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [country, setCountry] = useState("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  // Transaction Modal State
  const [showPending, setShowPending] = useState(false);
  const [pendingHash, setPendingHash] = useState<string | null>(null);
  const [pendingText, setPendingText] = useState("Waiting for confirmation...");

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!companyName.trim()) {
      setLocalError("Company name is required");
      return;
    }
    if (!taxId.trim()) {
      setLocalError("Tax ID/Registration number is required");
      return;
    }
    if (!country.trim()) {
      setLocalError("Country of incorporation is required");
      return;
    }

    setPendingText(
      `Registering business as verified ${regRole === "issuer" ? "SME / Issuer" : "Buyer"}...`,
    );
    setPendingHash(null);
    setShowPending(true);

    try {
      const metadata: Record<string, string> = {
        companyName: companyName.trim(),
        taxId: taxId.trim(),
        country: country.trim(),
        website: website.trim(),
        email: email.trim(),
      };

      const txHash = await register({
        role: regRole,
        metadata,
      });

      if (typeof txHash === "string") {
        setPendingHash(txHash);
      }
      setShowRegModal(false);
    } catch (err: any) {
      setLocalError(err.message || "Registration transaction failed");
      setShowPending(false);
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 10)}...${addr.slice(-10)}`;
  };

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
                      Your business wallet is fully whitelisted in the Registry
                      contract. All trading, invoice creation, and funding
                      pipelines are unlocked.
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
                        {address && formatAddress(address)}
                      </strong>{" "}
                      is not registered. You cannot create invoices, deploy
                      liquidity, or interact with pool escrows until you
                      register your credentials.
                    </p>
                  </div>
                </div>

                <div className="shrink-0">
                  <Button
                    onClick={() => {
                      setLocalError(null);
                      setShowRegModal(true);
                    }}
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
                  For businesses looking to capture liquidity. Registering as an
                  Issuer allows you to tokenize accounts receivable obligations,
                  list them at discounting rates, and request pool financing.
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
      </div>

      {/* Registration Modal Dialog */}
      {showRegModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#080c10]/95 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-card border border-border rounded-lg p-6 relative shadow-[0_0_50px_rgba(0,212,170,0.05)]">
            <button
              onClick={() => setShowRegModal(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-white font-bold font-mono text-xs uppercase"
            >
              [Close]
            </button>

            <div className="mb-6 border-b border-border/40 pb-3">
              <h2 className="text-sm font-bold font-mono tracking-wider uppercase text-white flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-primary" />
                Register Business Metadata
              </h2>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                Input your company credentials. This metadata maps to your
                wallet address on-chain.
              </p>
            </div>

            <form
              onSubmit={handleRegisterSubmit}
              className="space-y-4 font-mono text-xs"
            >
              {/* Role Toggle Selector */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Select On-Chain Business Role
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRegRole("issuer")}
                    className={`py-2 px-3 border rounded text-center transition-all ${
                      regRole === "issuer"
                        ? "border-primary bg-primary/5 text-primary font-bold"
                        : "border-border bg-transparent text-slate-400 hover:text-white hover:bg-slate-900/40"
                    }`}
                  >
                    SME / Issuer
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegRole("buyer")}
                    className={`py-2 px-3 border rounded text-center transition-all ${
                      regRole === "buyer"
                        ? "border-primary bg-primary/5 text-primary font-bold"
                        : "border-border bg-transparent text-slate-400 hover:text-white hover:bg-slate-900/40"
                    }`}
                  >
                    Obligor / Buyer
                  </button>
                </div>
              </div>

              {/* Company Name */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Company Name
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Corp"
                    className="w-full bg-[#080c10] border border-border rounded pl-10 pr-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>
              </div>

              {/* Tax ID & Country */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Tax ID / Registration No.
                  </label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. EU123456789"
                      className="w-full bg-[#080c10] border border-border rounded pl-10 pr-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      value={taxId}
                      onChange={(e) => setTaxId(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Country of Incorporation
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Germany"
                      className="w-full bg-[#080c10] border border-border rounded pl-10 pr-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Website URL */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Corporate Website URL (Optional)
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type="url"
                    placeholder="e.g. https://acme.corp"
                    className="w-full bg-[#080c10] border border-border rounded pl-10 pr-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Contact Email (Optional)
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    placeholder="e.g. admin@acme.corp"
                    className="w-full bg-[#080c10] border border-border rounded pl-10 pr-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* Warnings and errors */}
              {(localError || registerError) && (
                <div className="p-3 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    {localError ||
                      (registerError as any)?.message ||
                      "Failed to submit registration"}
                  </span>
                </div>
              )}

              <div className="bg-[#080c10] border border-amber-500/20 p-3 rounded text-[10px] text-amber-500 leading-normal flex items-start gap-1.5">
                <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Signing this registration requires Freighter authorization.
                  You will submit a Soroban write transaction, which whitelists
                  your wallet address and locks your business credentials.
                </span>
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRegModal(false)}
                  className="flex-1 border border-border bg-transparent hover:bg-slate-900 text-slate-400 font-bold uppercase py-2.5 rounded"
                  disabled={isRegistering}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-primary hover:bg-primary-hover text-black font-bold uppercase py-2.5 rounded shadow-[0_0_15px_rgba(0,212,170,0.15)] flex items-center justify-center gap-1.5"
                  disabled={isRegistering}
                >
                  {isRegistering ? "Signing..." : "Register Profile"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Pending Dialog Modal */}
      <TransactionPending
        isOpen={showPending}
        txHash={pendingHash}
        statusText={pendingText}
        onClose={
          pendingHash
            ? () => {
                setShowPending(false);
                setShowRegModal(false);
              }
            : undefined
        }
      />
    </PageLayout>
  );
}
