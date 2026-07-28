"use client";

import React, { useState } from "react";
import { PageLayout } from "@/components/shared/PageLayout";
import { useWalletStore } from "@/store/wallet";
import { useProfile } from "@/hooks/useProfile";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { WalletConnect } from "@/components/shared/WalletConnect";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
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

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.length > 0
  ) {
    return error.message;
  }

  return fallback;
}

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

  const [showRegModal, setShowRegModal] = useState(false);
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

      const txHash = await register({ role: regRole, metadata });
      if (typeof txHash === "string") {
        setPendingHash(txHash);
      }
      setShowRegModal(false);
    } catch (err: unknown) {
      setLocalError(getErrorMessage(err, "Registration transaction failed"));
      setShowPending(false);
    }
  };

  const formatAddress = (addr: string) =>
    `${addr.slice(0, 10)}...${addr.slice(-10)}`;

  if (!connected) {
    return (
      <PageLayout>
        <div className="flex min-h-[70vh] max-w-md mx-auto flex-col items-center justify-center py-20 text-center">
          <div className="mb-6 rounded-lg border border-primary/20 bg-primary/10 p-4 shadow-[0_0_20px_rgba(0,212,170,0.15)]">
            <Building2 className="h-12 w-12 text-primary" />
          </div>
          <h1 className="mb-2 font-mono text-2xl font-bold uppercase tracking-wider text-white">
            Connect Your Wallet
          </h1>
          <p className="mb-8 font-mono text-xs leading-relaxed text-slate-400">
            Connect your Freighter wallet to check your on-chain verification credentials, register a new business profile, or update your metadata.
          </p>
          <WalletConnect />
        </div>
      </PageLayout>
    );
  }

  const isLoading = isProfileLoading || isVerifiedLoading;

  return (
    <PageLayout>
      <div className="mx-auto max-w-4xl space-y-8 py-4">
        <div className="border-b border-border/40 pb-5">
          <h1 className="font-mono text-xl font-bold uppercase tracking-wider text-white">
            Business profile & Verification
          </h1>
          <p className="mt-1 font-mono text-xs text-slate-500">
            Manage your on-chain corporate credentials and verification states on the TrusTrove Registry contract.
          </p>
        </div>

        <ErrorBoundary context="ProfileContent">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center space-y-4 rounded-lg border border-border bg-[#0d131a] p-12 font-mono text-xs">
              <span className="h-1.5 w-1.5 animate-ping rounded-full bg-primary" />
              <span className="animate-pulse uppercase tracking-widest text-slate-400">
                Syncing credential ledger...
              </span>
            </div>
          ) : isVerified && profile ? (
            <div className="space-y-6">
              <div className="relative overflow-hidden rounded-lg border border-primary/30 bg-card p-6 shadow-[0_0_30px_rgba(0,212,170,0.06)] md:p-8">
                <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 rounded-lg border border-primary/30 bg-primary/10 p-3.5 text-primary">
                      <ShieldCheck className="h-8 w-8" />
                    </div>
                    <div>
                      <h2 className="font-mono text-lg font-bold uppercase text-white">Verified business profile</h2>
                      <p className="mt-2 font-mono text-xs text-primary">On-chain credentials verified</p>
                    </div>
                  </div>
                  <div className="rounded border border-primary/20 bg-primary/5 px-4 py-2 font-mono text-xs text-primary">
                    <Fingerprint className="mr-2 inline h-4 w-4" /> VERIFIED
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-card p-6">
                <h2 className="mb-4 font-mono text-sm font-bold uppercase text-white">Profile details</h2>
                <p className="break-all font-mono text-xs text-slate-400">
                  Wallet: {address ? formatAddress(address) : "Unavailable"}
                </p>
                <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-words rounded bg-black/20 p-4 font-mono text-xs text-slate-300">
                  {JSON.stringify(profile, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-amber-400" />
              <h2 className="font-mono text-lg font-bold uppercase text-white">Profile not registered</h2>
              <p className="mx-auto mt-2 max-w-lg font-mono text-xs leading-relaxed text-slate-400">
                Register your business to create an on-chain identity and begin the verification process.
              </p>
              <button
                type="button"
                onClick={() => setShowRegModal(true)}
                className="mt-6 rounded bg-primary px-5 py-3 font-mono text-xs font-bold uppercase text-black hover:bg-primary-hover"
              >
                Register business
              </button>
              {registerError && (
                <p className="mt-4 font-mono text-xs text-rose-400">
                  {getErrorMessage(registerError, "Unable to register profile")}
                </p>
              )}
            </div>
          )}
        </ErrorBoundary>
      </div>

      {showRegModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" ref={modalRef}>
          <form onSubmit={handleRegisterSubmit} className="w-full max-w-lg space-y-4 rounded-lg border border-border bg-card p-6">
            <h2 className="font-mono text-lg font-bold uppercase text-white">Register business</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <input required value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Company name" className="rounded border border-border bg-background p-3 font-mono text-xs text-white" />
              <input required value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="Tax ID / Registration number" className="rounded border border-border bg-background p-3 font-mono text-xs text-white" />
              <input required value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country" className="rounded border border-border bg-background p-3 font-mono text-xs text-white" />
              <select value={regRole} onChange={(e) => setRegRole(e.target.value as "issuer" | "buyer")} className="rounded border border-border bg-background p-3 font-mono text-xs text-white">
                <option value="issuer">SME / Issuer</option>
                <option value="buyer">Buyer</option>
              </select>
              <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="Website (optional)" className="rounded border border-border bg-background p-3 font-mono text-xs text-white" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" className="rounded border border-border bg-background p-3 font-mono text-xs text-white" />
            </div>
            {localError && <p className="font-mono text-xs text-rose-400">{localError}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowRegModal(false)} className="rounded border border-border px-4 py-2 font-mono text-xs text-slate-300">Cancel</button>
              <button type="submit" disabled={isRegistering} className="rounded bg-primary px-4 py-2 font-mono text-xs font-bold text-black disabled:opacity-50">{isRegistering ? "Registering..." : "Register"}</button>
            </div>
          </form>
        </div>
      )}

      {showPending && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg border border-primary/30 bg-card p-4 font-mono text-xs text-slate-300">
          <p>{pendingText}</p>
          {pendingHash && <p className="mt-2 break-all text-primary">Transaction: {pendingHash}</p>}
          <button type="button" onClick={() => setShowPending(false)} className="mt-3 text-slate-400 underline">Dismiss</button>
        </div>
      )}
    </PageLayout>
  );
}
