"use client";

import React, { useEffect, useState } from "react";
import { PageLayout } from "@/components/shared/PageLayout";
import { useWalletStore } from "@/store/wallet";
import { useProfile } from "@/hooks/useProfile";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import {
  NOTIFICATION_CATEGORIES,
  prefsStorageKey,
  readStoredPrefs,
} from "@/lib/notification-preferences";
import { WalletConnect } from "@/components/shared/WalletConnect";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { TransactionPending } from "@/components/shared/TransactionPending";
import { TxHistory } from "@/components/shared/TxHistory";

import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  ShieldAlert,
  Building2,
  FileBadge2,
  Building,
  Fingerprint,
  BellRing,
} from "lucide-react";

function NotificationPreferences({ address }: { address: string }) {
  const storageKey = prefsStorageKey(address);
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() =>
    readStoredPrefs(storageKey),
  );

  // React reuses this instance when the connected wallet changes, and the
  // storage key is derived from the address, so the new wallet's own stored
  // preferences must be re-read. Without this the previous account's toggles
  // stay on screen and the next click writes them into the new key.
  useEffect(() => {
    setPrefs(readStoredPrefs(storageKey));
  }, [storageKey]);

  const toggleCategory = (category: string) => {
    const nextPrefs = { ...prefs, [category]: !prefs[category] };
    setPrefs(nextPrefs);
    try {
      localStorage.setItem(storageKey, JSON.stringify(nextPrefs));
    } catch {}
  };

  return (
    <div className="mt-8 space-y-4">
      <div className="border-b border-border/40 pb-2">
        <h2 className="text-sm font-bold font-mono tracking-wider uppercase text-foreground flex items-center gap-2">
          <BellRing className="w-4 h-4 text-primary" />
          Notification Preferences
        </h2>
        <p className="text-muted-foreground text-[10px] font-mono mt-1">
          Choose which on-chain events trigger in-app notifications.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
        {NOTIFICATION_CATEGORIES.map((category) => (
          <div
            key={category}
            className="flex items-center justify-between p-3 rounded-lg border border-border bg-card"
          >
            <span className="text-foreground font-bold">{category}</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                aria-label={`${category} notifications`}
                checked={prefs[category] !== false}
                onChange={() => toggleCategory(category)}
              />
              <div className="w-9 h-5 bg-muted-foreground peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-card rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all motion-reduce:after:transition-none peer-checked:bg-primary"></div>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

const registryContractID = process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID || "";

export default function ProfilePage() {
  const { connected, address } = useWalletStore();
  const {
    profile,
    isProfileLoading,
    isVerified,
    isVerifiedLoading,
    isVerifiedError,
    refetchProfile,
    register,
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
      const message = err instanceof Error ? err.message : String(err);
      setLocalError(message || "Registration transaction failed");
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
          <h1 className="text-2xl font-bold font-mono tracking-wider text-foreground uppercase mb-2">
            Connect Your Wallet
          </h1>
          <p className="text-muted-foreground text-xs font-mono mb-8 leading-relaxed">
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
          <h1 className="text-xl font-bold font-mono tracking-wider uppercase text-foreground">
            Business profile & Verification
          </h1>
          <p className="text-muted-foreground text-xs font-mono mt-1">
            Manage your on-chain corporate credentials and verification states
            on the TrusTrove Registry contract.
          </p>
        </div>

        <ErrorBoundary context="ProfileContent">
          {isLoading ? (
            <div
              role="status"
              className="bg-card border border-border rounded-lg p-12 flex flex-col items-center justify-center space-y-4 font-mono text-xs"
            >
              <span
                aria-hidden="true"
                className="w-1.5 h-1.5 rounded-full bg-primary animate-ping"
              />
              <span className="text-muted-foreground uppercase tracking-widest animate-pulse">
                Loading profile credentials...
              </span>
            </div>
          ) : profile ? (
            <div className="space-y-6">
              {/* Status Banner */}
              <div className="bg-card border border-border rounded-lg p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div
                    className={`p-3 rounded-lg border ${
                      isVerifiedError
                        ? "bg-rose-500/10 border-rose-500/30 text-rose-500"
                        : isVerified
                          ? "bg-success/10 border-success/30 text-success"
                          : "bg-warning/10 border-warning/30 text-warning"
                    }`}
                  >
                    {isVerified ? (
                      <ShieldCheck className="w-6 h-6" />
                    ) : (
                      <ShieldAlert className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground uppercase">
                        Status:
                      </span>
                      <span
                        className={`text-xs font-mono font-bold uppercase ${
                          isVerifiedError
                            ? "text-rose-500"
                            : isVerified
                              ? "text-success"
                              : "text-warning"
                        }`}
                      >
                        {isVerifiedError
                          ? "Verification Check Failed"
                          : isVerified
                            ? "Verified Corporate"
                            : "Pending Review"}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold font-mono text-foreground mt-0.5">
                      {profile.role === "issuer" ? "SME / Issuer" : "Buyer"}{" "}
                      Profile
                    </h2>
                    <p className="text-xs font-mono text-muted-foreground mt-1">
                      Registered on Registry Contract • Address:{" "}
                      {address ? formatAddress(address) : "Address unavailable"}
                    </p>
                    {isVerifiedError && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs font-mono text-rose-400">
                          Couldn&apos;t verify status, try again.
                        </span>
                        <button
                          type="button"
                          onClick={() => refetchProfile()}
                          className="text-xs font-mono text-primary underline hover:text-primary/80"
                        >
                          Retry
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    aria-describedby="metadata-update-note"
                    className="font-mono text-xs border-border"
                  >
                    Update Metadata
                  </Button>
                  <p
                    id="metadata-update-note"
                    className="text-[10px] font-mono text-muted-foreground leading-relaxed max-w-[16rem] text-right"
                  >
                    Registration on the Registry contract is a one-time action
                    and the stored profile has no metadata fields, so an
                    existing profile cannot be updated from here.
                  </p>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-card border border-border rounded-lg p-6 space-y-4">
                  <h3 className="text-xs font-bold font-mono uppercase text-muted-foreground tracking-wider flex items-center gap-2">
                    <Building className="w-4 h-4 text-primary" />
                    Corporate Information
                  </h3>
                  <div className="space-y-3 text-xs font-mono">
                    <div className="flex justify-between py-2 border-b border-border/40">
                      <span className="text-muted-foreground">Role</span>
                      <span className="text-foreground uppercase font-bold">
                        {profile.role}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/40">
                      <span className="text-muted-foreground">
                        Wallet Address
                      </span>
                      <span className="text-foreground">
                        {formatAddress(profile.address)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/40">
                      <span className="text-muted-foreground">
                        Registered At
                      </span>
                      <span className="text-foreground">
                        {new Date(
                          profile.registeredAt * 1000,
                        ).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-lg p-6 space-y-4">
                  <h3 className="text-xs font-bold font-mono uppercase text-muted-foreground tracking-wider flex items-center gap-2">
                    <FileBadge2 className="w-4 h-4 text-primary" />
                    Verification Credentials
                  </h3>
                  <div className="space-y-3 text-xs font-mono">
                    <div className="flex justify-between py-2 border-b border-border/40">
                      <span className="text-muted-foreground">
                        On-Chain Status
                      </span>
                      <span
                        className={
                          isVerifiedError
                            ? "text-rose-500 font-bold"
                            : isVerified
                              ? "text-success font-bold"
                              : "text-warning font-bold"
                        }
                      >
                        {isVerifiedError
                          ? "Check Failed"
                          : isVerified
                            ? "Verified"
                            : "Unverified"}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/40">
                      <span className="text-muted-foreground">
                        Registry Contract
                      </span>
                      <span
                        className="text-foreground truncate max-w-[180px]"
                        title={registryContractID}
                      >
                        {registryContractID
                          ? formatAddress(registryContractID)
                          : "Not Configured"}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/40">
                      <span className="text-muted-foreground">Network</span>
                      <span className="text-foreground uppercase">
                        Stellar Testnet
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Registration Prompt */
            <div className="bg-card border border-border rounded-lg p-8 md:p-12 text-center max-w-2xl mx-auto space-y-6">
              <div className="w-14 h-14 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center mx-auto text-primary">
                <Fingerprint className="w-7 h-7" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold font-mono text-foreground">
                  No Business Profile Found
                </h2>
                <p className="text-xs font-mono text-muted-foreground leading-relaxed">
                  Your connected wallet is not yet registered on the TrusTrove
                  Registry contract. Register as an SME Issuer to tokenize
                  invoices or as a Buyer to verify and settle them.
                </p>
              </div>
              <Button
                className="font-mono text-xs font-bold"
                onClick={() => setShowRegModal(true)}
              >
                Register Business Profile
              </Button>
            </div>
          )}
        </ErrorBoundary>

        {address && <NotificationPreferences address={address} />}

        {address && (
          <ErrorBoundary context="TransactionHistory">
            <TxHistory address={address} />
          </ErrorBoundary>
        )}

        {/* Registration / Update Modal */}
        {showRegModal && (
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="registration-dialog-title"
            tabIndex={-1}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            <div className="bg-card border border-border rounded-lg p-6 md:p-8 max-w-lg w-full space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-border/40 pb-4">
                <h2
                  id="registration-dialog-title"
                  className="text-base font-bold font-mono text-foreground uppercase tracking-wider"
                >
                  {profile
                    ? "Update Profile Metadata"
                    : "Register Corporate Profile"}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowRegModal(false)}
                  aria-label="Close registration dialog"
                  className="text-muted-foreground hover:text-foreground font-mono text-sm"
                >
                  ✕
                </button>
              </div>

              {localError && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive text-xs font-mono p-3 rounded-lg flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{localError}</span>
                </div>
              )}

              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                {!profile && (
                  <div className="space-y-2">
                    <label className="text-xs font-mono text-muted-foreground uppercase">
                      Role
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setRegRole("issuer")}
                        className={`py-2.5 px-4 rounded-lg font-mono text-xs font-bold border transition-all ${
                          regRole === "issuer"
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-background border-border text-muted-foreground hover:border-primary/40"
                        }`}
                      >
                        SME / Issuer
                      </button>
                      <button
                        type="button"
                        onClick={() => setRegRole("buyer")}
                        className={`py-2.5 px-4 rounded-lg font-mono text-xs font-bold border transition-all ${
                          regRole === "buyer"
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-background border-border text-muted-foreground hover:border-primary/40"
                        }`}
                      >
                        Buyer
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-mono text-muted-foreground uppercase">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Acme Corporation"
                    className="w-full bg-background border border-input rounded-lg px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-mono text-muted-foreground uppercase">
                    Tax ID / Registration Number *
                  </label>
                  <input
                    type="text"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    placeholder="e.g. REG-123456789"
                    className="w-full bg-background border border-input rounded-lg px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-mono text-muted-foreground uppercase">
                    Country of Incorporation *
                  </label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="e.g. United States"
                    className="w-full bg-background border border-input rounded-lg px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-mono text-muted-foreground uppercase">
                      Website (Optional)
                    </label>
                    <input
                      type="text"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://acme.com"
                      className="w-full bg-background border border-input rounded-lg px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-mono text-muted-foreground uppercase">
                      Email (Optional)
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="contact@acme.com"
                      className="w-full bg-background border border-input rounded-lg px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border/40">
                  <Button
                    type="button"
                    variant="outline"
                    className="font-mono text-xs"
                    onClick={() => setShowRegModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="font-mono text-xs font-bold">
                    {profile ? "Save Changes" : "Submit Registration"}
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
          statusText={pendingText}
          txHash={pendingHash}
        />
      </div>
    </PageLayout>
  );
}
