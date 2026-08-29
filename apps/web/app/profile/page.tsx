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

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = error.message;
    if (typeof message === "string") {
      return message;
    }
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
    } catch (error: unknown) {
      setLocalError(getErrorMessage(error, "Registration transaction failed"));
      setShowPending(false);
    }
  };

  const formatAddress = (value: string) =>
    `${value.slice(0, 10)}...${value.slice(-10)}`;

  const displayedError = localError ??
    (registerError
      ? getErrorMessage(registerError as unknown, "Registration transaction failed")
      : null);

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
            Connect your Freighter wallet to check your on-chain verification
            credentials, register a new business profile, or update your metadata.
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
            Business Profile & Verification
          </h1>
          <p className="mt-1 font-mono text-xs text-slate-500">
            Manage your on-chain corporate credentials and verification state on
            the TrusTrove Registry contract.
          </p>
        </div>

        <ErrorBoundary context="ProfileContent">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center space-y-4 rounded-lg border border-border bg-[#0d131a] p-12 font-mono text-xs">
              <span className="h-1.5 w-1.5 animate-ping rounded-full bg-primary" />
              <span className="animate-pulse uppercase tracking-widest text-slate-400">
                Loading profile...
              </span>
            </div>
          ) : profile ? (
            <div className="space-y-8 rounded-lg border border-border bg-[#0d131a] p-6 shadow-xl md:p-8">
              <div className="flex flex-col justify-between gap-4 rounded-lg border border-border/60 bg-slate-900/50 p-5 md:flex-row md:items-center">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                    {profile.role === "issuer" ? (
                      <Building2 className="h-7 w-7" />
                    ) : (
                      <UserCheck className="h-7 w-7" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs uppercase tracking-wider text-slate-400">Role:</span>
                      <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold uppercase text-primary">
                        {profile.role === "issuer" ? "SME / Issuer" : "Buyer"}
                      </span>
                    </div>
                    <h2 className="mt-1 font-mono text-lg font-bold text-white">
                      {formatAddress(profile.address)}
                    </h2>
                  </div>
                </div>
                {isVerified ? (
                  <div className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 font-mono text-xs font-bold uppercase text-emerald-400">
                    <ShieldCheck className="h-4 w-4" /> Verified
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 font-mono text-xs font-bold uppercase text-amber-400">
                    <ShieldAlert className="h-4 w-4" /> Pending Verification
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border/60 bg-black/20 p-4">
                  <span className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <Fingerprint className="h-3.5 w-3.5" /> Account Address
                  </span>
                  <p className="mt-2 break-all font-mono text-xs text-slate-300">{profile.address}</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-black/20 p-4">
                  <span className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <Calendar className="h-3.5 w-3.5" /> Registered
                  </span>
                  <p className="mt-2 font-mono text-xs text-slate-300">
                    {new Date(profile.registeredAt * 1000).toLocaleDateString()}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-black/20 p-4">
                  <span className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <Lock className="h-3.5 w-3.5" /> Registry Contract
                  </span>
                  <p className="mt-2 break-all font-mono text-xs text-slate-300">
                    {registryContractID || "Not configured"}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-black/20 p-4">
                  <span className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <FileBadge2 className="h-3.5 w-3.5" /> Credential Status
                  </span>
                  <p className="mt-2 font-mono text-xs text-slate-300">
                    {isVerified ? "Verified on-chain" : "Awaiting registry verification"}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center rounded-lg border border-border bg-[#0d131a] p-10 text-center">
              <Building className="mb-4 h-10 w-10 text-slate-500" />
              <h2 className="font-mono text-lg font-bold uppercase text-white">No Business Profile</h2>
              <p className="mt-2 max-w-lg font-mono text-xs leading-relaxed text-slate-500">
                Register your organization with the Registry contract to establish
                an on-chain business identity.
              </p>
              <Button
                className="mt-6 bg-primary font-mono font-bold text-black hover:bg-primary/90"
                onClick={() => {
                  setLocalError(null);
                  setShowRegModal(true);
                }}
              >
                Register Business
              </Button>
            </div>
          )}
        </ErrorBoundary>
      </div>

      {showRegModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="registration-title"
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg border border-border bg-[#0d131a] p-6 shadow-2xl"
          >
            <div className="mb-6 flex items-start justify-between gap-4 border-b border-border/60 pb-4">
              <div>
                <h2 id="registration-title" className="font-mono text-lg font-bold uppercase text-white">
                  Register Business
                </h2>
                <p className="mt-1 font-mono text-xs text-slate-500">Create an on-chain Registry profile.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowRegModal(false)}
                className="font-mono text-lg text-slate-500 hover:text-white"
                aria-label="Close registration dialog"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <label className="block space-y-2">
                <span className="font-mono text-xs font-bold uppercase text-slate-400">Business Role</span>
                <select
                  value={regRole}
                  onChange={(event) => setRegRole(event.target.value as "issuer" | "buyer")}
                  className="w-full rounded-md border border-border bg-slate-950 px-3 py-2 font-mono text-sm text-white"
                >
                  <option value="issuer">SME / Issuer</option>
                  <option value="buyer">Buyer</option>
                </select>
              </label>

              <label className="block space-y-2">
                <span className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase text-slate-400"><Building className="h-3.5 w-3.5" /> Company Name *</span>
                <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} className="w-full rounded-md border border-border bg-slate-950 px-3 py-2 font-mono text-sm text-white" />
              </label>

              <label className="block space-y-2">
                <span className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase text-slate-400"><FileText className="h-3.5 w-3.5" /> Tax ID / Registration Number *</span>
                <input value={taxId} onChange={(event) => setTaxId(event.target.value)} className="w-full rounded-md border border-border bg-slate-950 px-3 py-2 font-mono text-sm text-white" />
              </label>

              <label className="block space-y-2">
                <span className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase text-slate-400"><Globe className="h-3.5 w-3.5" /> Country of Incorporation *</span>
                <input value={country} onChange={(event) => setCountry(event.target.value)} className="w-full rounded-md border border-border bg-slate-950 px-3 py-2 font-mono text-sm text-white" />
              </label>

              <label className="block space-y-2">
                <span className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase text-slate-400"><Globe className="h-3.5 w-3.5" /> Website</span>
                <input type="url" value={website} onChange={(event) => setWebsite(event.target.value)} className="w-full rounded-md border border-border bg-slate-950 px-3 py-2 font-mono text-sm text-white" />
              </label>

              <label className="block space-y-2">
                <span className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase text-slate-400"><Mail className="h-3.5 w-3.5" /> Contact Email</span>
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-md border border-border bg-slate-950 px-3 py-2 font-mono text-sm text-white" />
              </label>

              {displayedError && (
                <div className="flex items-start gap-2 rounded-md border border-rose-500/20 bg-rose-500/10 p-3 font-mono text-xs text-rose-400">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>{displayedError}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-border/60 pt-5">
                <Button type="button" variant="outline" onClick={() => setShowRegModal(false)} disabled={isRegistering}>Cancel</Button>
                <Button type="submit" disabled={isRegistering} className="bg-primary font-bold text-black hover:bg-primary/90">
                  {isRegistering ? "Registering..." : "Submit Registration"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <TransactionPending
        isOpen={showPending}
        onClose={() => setShowPending(false)}
        txHash={pendingHash}
        text={pendingText}
      />
    </PageLayout>
  );
}
