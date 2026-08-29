"use client";

import React, { useState } from "react";
import { PageLayout } from "@/components/shared/PageLayout";
import { useWalletStore } from "@/store/wallet";
import { useProfile } from "@/hooks/useProfile";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { WalletConnect } from "@/components/shared/WalletConnect";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
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

  // Modal Refs
  const modalRef = useFocusTrap<HTMLDivElement>(showRegModal, () =>
    setShowRegModal(false),
  );

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
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err && typeof (err as { message: unknown }).message === "string"
            ? (err as { message: string }).message
            : "Registration transaction failed";
      setLocalError(errorMessage);
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

        <ErrorBoundary context="ProfileContent">
          {isLoading ? (
            <div className="bg-[#0d131a] border border-border rounded-lg p-12 flex flex-col items-center justify-center space-y-4 font-mono text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
              <span className="text-slate-400 uppercase tracking-widest animate-pulse">
                Loading profile...
              </span>
            </div>
          ) : profile ? (
            <div className="bg-[#0d131a] border border-border rounded-lg p-6 md:p-8 space-y-8 shadow-xl">
              {/* Profile Card Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/50 border border-border/60 p-5 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                    {profile.role === "issuer" ? (
                      <Building2 className="w-7 h-7" />
                    ) : (
                      <UserCheck className="w-7 h-7" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                        Role:
                      </span>
                      <span className="text-xs font-mono font-bold text-primary uppercase bg-primary/10 px-2 py-0.5 rounded">
                        {profile.role === "issuer" ? "SME / Issuer" : "Buyer"}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold font-mono text-white mt-1">
                      {formatAddress(profile.address)}
                    </h2>
                  </div>
                </div>
                <div>
                  {isVerified ? (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-xs font-bold uppercase">
                      <ShieldCheck className="w-4 h-4" />
                      Verified On-Chain
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono text-xs font-bold uppercase">
                      <ShieldAlert className="w-4 h-4" />
                      Unverified Profile
                    </div>
                  )}
                </div>
              </div>

              {/* Metadata details */}
              <div className="space-y-4">
                <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest">
                  Corporate Metadata
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
                  <div className="bg-slate-900/40 border border-border/40 p-4 rounded-lg">
                    <span className="text-slate-500 block mb-1">Registered At</span>
                    <span className="text-white font-bold">
                      {new Date(profile.registeredAt * 1000).toLocaleString()}
                    </span>
                  </div>
                  <div className="bg-slate-900/40 border border-border/40 p-4 rounded-lg">
                    <span className="text-slate-500 block mb-1">Contract ID</span>
                    <span className="text-white font-bold truncate block">
                      {registryContractID}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#0d131a] border border-border rounded-lg p-12 text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary">
                <FileBadge2 className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <h2 className="text-lg font-bold font-mono text-white uppercase tracking-wider">
                  No Business Profile Found
                </h2>
                <p className="text-slate-400 text-xs font-mono leading-relaxed">
                  You are not yet registered on the TrusTrove Registry contract.
                  Register as an SME Issuer or Buyer to issue or finance invoices.
                </p>
              </div>
              <div>
                <Button
                  onClick={() => setShowRegModal(true)}
                  className="bg-primary text-slate-950 font-mono font-bold hover:bg-primary/90 transition-all uppercase text-xs tracking-wider px-6 py-2.5"
                >
                  Register Profile Now
                </Button>
              </div>
            </div>
          )}
        </ErrorBoundary>
      </div>

      {/* Registration Modal */}
      {showRegModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div
            ref={modalRef}
            className="bg-slate-900 border border-border rounded-lg max-w-lg w-full p-6 md:p-8 space-y-6 shadow-2xl relative font-mono text-xs"
          >
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Register Business Profile
              ++  </h2>
              <button
                onClick={() => setShowRegModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              {localError && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-lg flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{localError}</span>
                </div>
              )}

              {registerError && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-lg flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    {registerError instanceof Error
                      ? registerError.message
                      : typeof registerError === "object" && registerError !== null && "message" in registerError && typeof (registerError as { message: unknown }).message === "string"
                        ? (registerError as { message: string }).message
                        : "Registration failed"}
                  </span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-slate-400 block uppercase tracking-wider">
                  Role
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRegRole("issuer")}
                    className={`py-2.5 px-4 rounded-lg font-bold border transition-all uppercase tracking-wider ${
                      regRole === "issuer"
                        ? "bg-primary/20 border-primary text-primary"
                        : "bg-slate-950 border-border text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    SME / Issuer
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegRole("buyer")}
                    className={`py-2.5 px-4 rounded-lg font-bold border transition-all uppercase tracking-wider ${
                      regRole === "buyer"
                        ? "bg-primary/20 border-primary text-primary"
                        : "bg-slate-950 border-border text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    Buyer
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 block uppercase tracking-wider">
                  Company Name *
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Acme Corp"
                    required
                    className="w-full bg-slate-950 border border-border rounded-lg pl-9 pr-3 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 block uppercase tracking-wider">
                  Tax ID / Registration Number *
                </label>
                <div className="relative">
                  <Fingerprint className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    placeholder="REG-12345678"
                    required
                    className="w-full bg-slate-950 border border-border rounded-lg pl-9 pr-3 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 block uppercase tracking-wider">
                  Country of Incorporation *
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="United States"
                    required
                    className="w-full bg-slate-950 border border-border rounded-lg pl-9 pr-3 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-400 block uppercase tracking-wider">
                    Website
                  </label>
                  <input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://acme.com"
                    className="w-full bg-slate-950 border border-border rounded-lg px-3 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400 block uppercase tracking-wider">
                    Corporate Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contact@acme.com"
                    className="w-full bg-slate-950 border border-border rounded-lg px-3 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowRegModal(false)}
                  className="border-border text-slate-400 hover:text-white uppercase font-bold text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isRegistering}
                  className="bg-primary text-slate-950 hover:bg-primary/90 font-bold uppercase text-xs"
                >
                  {isRegistering ? "Registering..." : "Confirm & Submit"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Pending Modal */}
      <TransactionPending
        isOpen={showPending}
        onClose={() => setShowPending(false)}
        txHash={pendingHash}
        title="Business Profile Registration"
        description={pendingText}
      />
    </PageLayout>
  );
}
