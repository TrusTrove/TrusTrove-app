"use client";

import React, { useState } from "react";
import { PageLayout } from "@/components/shared/PageLayout";
import { useWalletStore } from "@/store/wallet";
import { useProfile } from "@/hooks/useProfile";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { WalletConnect } from "@/components/shared/WalletConnect";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ShieldAlert, Building2 } from "lucide-react";

function getErrorMessage(error: unknown): string | null {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return null;
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

  const handleRegisterSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
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

    try {
      await register({
        role: regRole,
        metadata: {
          companyName: companyName.trim(),
          taxId: taxId.trim(),
          country: country.trim(),
          website: website.trim(),
          email: email.trim(),
        },
      });
      setShowRegModal(false);
    } catch (error: unknown) {
      setLocalError(
        getErrorMessage(error) ?? "Registration transaction failed",
      );
    }
  };

  const errorMessage = localError ?? getErrorMessage(registerError);
  const isLoading = isProfileLoading || isVerifiedLoading;

  if (!connected) {
    return (
      <PageLayout>
        <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center py-20 text-center">
          <div className="mb-6 rounded-lg border border-primary/20 bg-primary/10 p-4">
            <Building2 className="h-12 w-12 text-primary" />
          </div>
          <h1 className="mb-2 font-mono text-2xl font-bold uppercase tracking-wider text-white">
            Connect Your Wallet
          </h1>
          <p className="mb-8 font-mono text-xs leading-relaxed text-slate-400">
            Connect your Freighter wallet to check your on-chain verification
            credentials or register a new business profile.
          </p>
          <WalletConnect />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="mx-auto max-w-4xl space-y-8 py-4">
        <div className="border-b border-border/40 pb-5">
          <h1 className="font-mono text-xl font-bold uppercase tracking-wider text-white">
            Business profile &amp; Verification
          </h1>
          <p className="mt-1 font-mono text-xs text-slate-500">
            Manage your on-chain corporate credentials and verification states.
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
                <div className="relative z-10 flex items-center gap-4">
                  <div className="rounded-lg border border-primary/30 bg-primary/10 p-3.5 text-primary">
                    <ShieldCheck className="h-8 w-8" />
                  </div>
                  <div>
                    <h2 className="font-mono text-lg font-bold uppercase text-white">
                      Verified profile
                    </h2>
                    <p className="mt-1 font-mono text-xs text-primary">
                      This wallet has an on-chain verification credential.
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-card p-6 font-mono">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Wallet Address
                </p>
                <p className="mt-1 break-all text-sm text-white">{address}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6 rounded-lg border border-border bg-card p-6">
              <div className="flex items-center gap-4">
                <ShieldAlert className="h-8 w-8 text-amber-400" />
                <div>
                  <h2 className="font-mono text-lg font-bold uppercase text-white">
                    No verified profile
                  </h2>
                  <p className="font-mono text-xs text-slate-400">
                    Register your business to create an on-chain profile.
                  </p>
                </div>
              </div>
              <Button onClick={() => setShowRegModal(true)}>
                Register business profile
              </Button>
              {errorMessage && (
                <p className="rounded border border-rose-500/20 bg-rose-500/10 p-3 font-mono text-xs text-rose-400">
                  {errorMessage}
                </p>
              )}
            </div>
          )}
        </ErrorBoundary>

        {showRegModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div ref={modalRef} className="w-full max-w-lg rounded-lg border border-border bg-card p-6">
              <h2 className="mb-5 font-mono text-lg font-bold uppercase text-white">
                Register business profile
              </h2>
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {(["issuer", "buyer"] as const).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setRegRole(role)}
                      className={`rounded border p-2 font-mono text-xs uppercase ${regRole === role ? "border-primary text-primary" : "border-border text-slate-400"}`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
                <input required value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Company name" className="w-full rounded border border-border bg-background p-2 text-sm text-white" />
                <input required value={taxId} onChange={(event) => setTaxId(event.target.value)} placeholder="Tax ID / Registration number" className="w-full rounded border border-border bg-background p-2 text-sm text-white" />
                <input required value={country} onChange={(event) => setCountry(event.target.value)} placeholder="Country of incorporation" className="w-full rounded border border-border bg-background p-2 text-sm text-white" />
                <input value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="Website (optional)" className="w-full rounded border border-border bg-background p-2 text-sm text-white" />
                <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email (optional)" className="w-full rounded border border-border bg-background p-2 text-sm text-white" />
                {errorMessage && <p className="text-xs text-rose-400">{errorMessage}</p>}
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setShowRegModal(false)}>Cancel</Button>
                  <Button type="submit" disabled={isRegistering}>{isRegistering ? "Registering..." : "Register"}</Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
