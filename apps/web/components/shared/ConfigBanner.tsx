"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";
import { validateConfig } from "@/lib/config";

export function ConfigBanner() {
  const config = validateConfig();

  if (config.isConfigured) return null;

  const envVarLabels: Record<string, string> = {
    NEXT_PUBLIC_STELLAR_NETWORK: "Stellar Network",
    NEXT_PUBLIC_HORIZON_URL: "Horizon URL",
    NEXT_PUBLIC_SOROBAN_RPC_URL: "Soroban RPC URL",
    NEXT_PUBLIC_NETWORK_PASSPHRASE: "Network Passphrase",
    NEXT_PUBLIC_REGISTRY_CONTRACT_ID: "Registry Contract",
    NEXT_PUBLIC_INVOICE_CONTRACT_ID: "Invoice Contract",
    NEXT_PUBLIC_POOL_CONTRACT_ID: "Pool Contract",
    NEXT_PUBLIC_ESCROW_CONTRACT_ID: "Escrow Contract",
    NEXT_PUBLIC_USDC_ISSUER: "USDC Issuer",
    NEXT_PUBLIC_USDC_ASSET_CODE: "USDC Asset Code",
  };

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-3">
      <div className="max-w-6xl mx-auto flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="font-mono text-xs">
          <p className="font-bold text-amber-400 uppercase tracking-wider mb-1">
            Configuration Error
          </p>
          {config.missing.length > 0 && (
            <p className="text-amber-400/70 leading-relaxed mb-1">
              Missing required environment variables:{" "}
              {config.missing.map((key) => envVarLabels[key] || key).join(", ")}
              .. Contract interactions will fail until these are configured in{" "}
              <code className="text-amber-500 bg-black/30 px-1 rounded">
                .env.local
              </code>
              .
            </p>
          )}
          {config.invalid.length > 0 && (
            <p className="text-amber-400/70 leading-relaxed">
              Invalid or inconsistent environment variables (network/format mismatch):{" "}
              {config.invalid.map((key) => envVarLabels[key] || key).join(", ")}
              .. Please check your configuration in{" "}
              <code className="text-amber-500 bg-black/30 px-1 rounded">
                .env.local
              </code>
              .
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
