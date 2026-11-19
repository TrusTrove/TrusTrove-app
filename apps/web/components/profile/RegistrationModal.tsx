"use client";

import React, { useEffect, useState } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { TransactionPending } from "@/components/shared/TransactionPending";
import {
  ShieldAlert,
  Building2,
  Globe,
  FileText,
  Lock,
  Mail,
} from "lucide-react";
import type { useProfile } from "@/hooks/useProfile";

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  register: ReturnType<typeof useProfile>["register"];
  isRegistering: boolean;
  registerError: ReturnType<typeof useProfile>["registerError"];
}

export function RegistrationModal({
  isOpen,
  onClose,
  register,
  isRegistering,
  registerError,
}: RegistrationModalProps) {
  const modalRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);

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

  // Clear any stale error from a previous attempt each time the dialog opens.
  useEffect(() => {
    if (isOpen) setLocalError(null);
  }, [isOpen]);

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
    // Close the registration modal before opening the pending dialog so only
    // one aria-modal dialog (and one focus trap) is active at a time (#1099).
    onClose();
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
    } catch (err: any) {
      setLocalError(err.message || "Registration transaction failed");
      setShowPending(false);
    }
  };

  return (
    <>
      {isOpen && (
        <ErrorBoundary context="RegistrationModal">
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="registration-dialog-title"
            tabIndex={-1}
            className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-0 md:p-4"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                onClose();
              }
            }}
          >
            <div
              className="w-full max-w-lg max-h-[92vh] md:max-h-[85vh] overflow-y-auto overscroll-contain bg-card border md:border-border rounded-t-2xl md:rounded-lg p-6 relative shadow-[0_0_50px_rgba(0,212,170,0.05)]"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                onClick={onClose}
                aria-label="Close registration dialog"
                className="absolute top-3 right-3 min-h-[44px] px-2 text-muted-foreground hover:text-foreground font-bold font-mono text-xs uppercase"
              >
                [Close]
              </button>

              <div className="mb-6 border-b border-border/40 pb-3">
                <h2
                  id="registration-dialog-title"
                  className="text-sm font-bold font-mono tracking-wider uppercase text-foreground flex items-center gap-1.5 pr-16"
                >
                  <Building2 className="w-4 h-4 text-primary" />
                  Register Business Metadata
                </h2>
                <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                  Input your company credentials. This metadata maps to your
                  wallet address on-chain.
                </p>
              </div>

              <form
                onSubmit={handleRegisterSubmit}
                className="space-y-4 font-mono text-xs"
              >
                {/* Role Toggle Selector */}
                <fieldset className="space-y-2">
                  <legend className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                    Select On-Chain Business Role
                  </legend>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { value: "issuer", label: "SME / Issuer" },
                        { value: "buyer", label: "Obligor / Buyer" },
                      ] as const
                    ).map((option) => (
                      <label
                        key={option.value}
                        className={`py-2 px-3 border rounded text-center cursor-pointer transition-all focus-within:ring-2 focus-within:ring-primary ${
                          regRole === option.value
                            ? "border-primary bg-primary/5 text-primary font-bold"
                            : "border-border bg-transparent text-muted-foreground hover:text-foreground hover:bg-background"
                        }`}
                      >
                        <input
                          type="radio"
                          name="registration-role"
                          value={option.value}
                          checked={regRole === option.value}
                          onChange={() => setRegRole(option.value)}
                          className="sr-only"
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </fieldset>

                {/* Company Name */}
                <div className="space-y-1">
                  <label
                    htmlFor="registration-company-name"
                    className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider"
                  >
                    Company Name
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                    <input
                      id="registration-company-name"
                      type="text"
                      required
                      placeholder="e.g. Acme Corporation"
                      className="w-full bg-background border border-input rounded pl-10 pr-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                    />
                  </div>
                </div>

                {/* Tax ID & Country */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label
                      htmlFor="registration-tax-id"
                      className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider"
                    >
                      Tax ID / Registration No.
                    </label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                      <input
                        id="registration-tax-id"
                        type="text"
                        required
                        placeholder="e.g. EU123456789"
                        className="w-full bg-background border border-input rounded pl-10 pr-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        value={taxId}
                        onChange={(e) => setTaxId(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="registration-country"
                      className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider"
                    >
                      Country of Incorporation
                    </label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                      <input
                        id="registration-country"
                        type="text"
                        required
                        placeholder="e.g. Germany"
                        className="w-full bg-background border border-input rounded pl-10 pr-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Website URL */}
                <div className="space-y-1">
                  <label
                    htmlFor="registration-website"
                    className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider"
                  >
                    Corporate Website URL (Optional)
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                    <input
                      id="registration-website"
                      type="url"
                      placeholder="e.g. https://acme.corp"
                      className="w-full bg-background border border-input rounded pl-10 pr-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                    />
                  </div>
                </div>

                {/* Contact Email */}
                <div className="space-y-1">
                  <label
                    htmlFor="registration-email"
                    className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider"
                  >
                    Contact Email (Optional)
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                    <input
                      id="registration-email"
                      type="email"
                      placeholder="e.g. contact@acme.corp"
                      className="w-full bg-background border border-input rounded pl-10 pr-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                {/* Warnings and errors */}
                {(localError || registerError) && (
                  <div
                    role="alert"
                    className="p-3 rounded bg-destructive/10 border border-destructive/30 text-destructive text-[11px] flex items-start gap-2"
                  >
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      {localError ||
                        (registerError as any)?.message ||
                        "Failed to submit registration"}
                    </span>
                  </div>
                )}

                <div className="bg-warning/10 border border-warning/30 p-3 rounded text-[10px] text-warning leading-normal flex items-start gap-1.5">
                  <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    Signing this registration requires Freighter authorization.
                    You will submit a Soroban write transaction, which
                    whitelists your wallet address and locks your business
                    credentials.
                  </span>
                </div>

                {/* Buttons */}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 border border-border bg-transparent hover:bg-background text-foreground font-bold uppercase py-2.5 rounded"
                    disabled={isRegistering}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold uppercase py-2.5 rounded shadow-[0_0_15px_rgba(0,212,170,0.15)] flex items-center justify-center gap-1.5"
                    disabled={isRegistering}
                  >
                    {isRegistering ? "Signing..." : "Register Profile"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ErrorBoundary>
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
                onClose();
              }
            : undefined
        }
      />
    </>
  );
}
