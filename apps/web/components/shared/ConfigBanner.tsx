"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";
import { validateConfig } from "@/lib/config";

export function ConfigBanner() {
  const config = validateConfig();

  if (config.isConfigured) return null;

  const envVarLabels: Record<string, string> = {
    NEXT_PUBLIC_INVOICE_CONTRACT_ID: "Invoice Contract",
    NEXT_PUBLIC_POOL_CONTRACT_ID: "Pool Contract",
    NEXT_PUBLIC_REGISTRY_CONTRACT_ID: "Registry Contract",
  };

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-3">
      <div className="max-w-6xl mx-auto flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="font-mono text-xs">
          <p className="font-bold text-amber-400 uppercase tracking-wider mb-1">
            Configuration Error
          </p>
          <p className="text-amber-400/70 leading-relaxed">
            Missing required environment variables:{" "}
            {config.missing.map((key) => envVarLabels[key] || key).join(", ")}
            .. Contract interactions will fail until these are configured in{" "}
            <code className="text-amber-500 bg-black/30 px-1 rounded">
              .env.local
            </code>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
