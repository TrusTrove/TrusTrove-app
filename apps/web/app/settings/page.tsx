"use client";

import React, { useState, useEffect, useCallback } from "react";
import { PageLayout } from "@/components/shared/PageLayout";
import { useWalletStore } from "@/store/wallet";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { Shield, Bell, Database, Palette, Monitor, Layers } from "lucide-react";

export default function SettingsPage() {
  const connected = useWalletStore((s) => s.connected);
  const address = useWalletStore((s) => s.address);
  const [displayDensity, setDisplayDensity] = useState<"comfortable" | "compact">(
    "comfortable",
  );
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Load display preferences from localStorage
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("trusttrove:display");
      if (stored) {
        const prefs = JSON.parse(stored);
        if (prefs.density) setDisplayDensity(prefs.density);
        if (typeof prefs.animations === "boolean")
          setAnimationsEnabled(prefs.animations);
        if (typeof prefs.reducedMotion === "boolean")
          setReducedMotion(prefs.reducedMotion);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Save display preferences to localStorage
  const saveDisplayPrefs = useCallback(() => {
    try {
      window.localStorage.setItem(
        "trusttrove:display",
        JSON.stringify({
          density: displayDensity,
          animations: animationsEnabled,
          reducedMotion,
        }),
      );
    } catch {
      // Ignore storage errors
    }
  }, [displayDensity, animationsEnabled, reducedMotion]);

  useEffect(() => {
    saveDisplayPrefs();
    document.documentElement.style.setProperty(
      "--density",
      displayDensity === "compact" ? "compact" : "comfortable",
    );
  }, [displayDensity, animationsEnabled, reducedMotion, saveDisplayPrefs]);

  // Apply reduced motion preference
  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", reducedMotion);
  }, [reducedMotion]);

  function AppearanceSection() {
  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-bold font-mono uppercase text-white mb-3 flex items-center gap-2">
          <Palette className="w-4 h-4 text-primary" />
          Theme
        </h4>
        <p className="text-slate-500 text-xs font-mono mb-3">
          Choose your preferred color scheme. System preference follows
          your OS setting.
        </p>
        <ThemeToggle />
      </div>

      <div className="border-t border-border/40 pt-6">
        <h4 className="text-sm font-bold font-mono uppercase text-white mb-3 flex items-center gap-2">
          <Monitor className="w-4 h-4 text-primary" />
          Display Density
        </h4>
        <p className="text-slate-500 text-xs font-mono mb-3">
          Adjust the spacing and size of UI elements.
        </p>
        <div className="flex gap-4">
          {(["comfortable", "compact"] as const).map((density) => (
            <label
              key={density}
              className={`flex-1 p-4 rounded-lg border-2 transition-all cursor-pointer ${
                displayDensity === density
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <input
                type="radio"
                name="density"
                value={density}
                checked={displayDensity === density}
                onChange={() => setDisplayDensity(density)}
                className="sr-only"
              />
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-8 rounded border border-border/40 ${
                    density === "compact" ? "bg-slate-800" : "bg-slate-900"
                  }`}
                >
                  <div
                    className={`h-3 w-3/4 rounded bg-primary/20 ${
                      density === "compact" ? "mt-1 ml-1" : "mt-1.5 ml-1.5"
                    }`}
                  />
                  <div
                    className={`h-1.5 w-full rounded bg-slate-700 ${
                      density === "compact" ? "mt-1 ml-1" : "mt-1.5 ml-1.5"
                    }`}
                  />
                  <div
                    className={`h-1.5 w-2/3 rounded bg-slate-700 ${
                      density === "compact" ? "mt-0.5 ml-1" : "mt-1 ml-1.5"
                    }`}
                  />
                </div>
                <span className="font-mono text-xs font-bold text-white capitalize">
                  {density}
                </span>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="border-t border-border/40 pt-6">
        <h4 className="text-sm font-bold font-mono uppercase text-white mb-3 flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          Motion & Animation
        </h4>
        <p className="text-slate-500 text-xs font-mono mb-3">
          Control UI animations and transitions.
        </p>
        <div className="space-y-3">
          <label className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
            <div>
              <span className="font-mono text-xs font-bold text-white block">
                UI Animations
              </span>
              <span className="text-slate-500 text-[10px] block mt-0.5">
                Enable transitions, hover effects, and micro-interactions
              </span>
            </div>
            <input
              type="checkbox"
              checked={animationsEnabled}
              onChange={(e) => setAnimationsEnabled(e.target.checked)}
              className="w-5 h-5 accent-primary cursor-pointer"
            />
          </label>
          <label className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
            <div>
              <span className="font-mono text-xs font-bold text-white block">
                Reduced Motion
              </span>
              <span className="text-slate-500 text-[10px] block mt-0.5">
                Minimize non-essential motion (respects OS preference)
              </span>
            </div>
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(e) => setReducedMotion(e.target.checked)}
              className="w-5 h-5 accent-primary cursor-pointer"
            />
          </label>
        </div>
      </div>
    </div>
  );
}

function NotificationsSection() {
  return (
    <div className="space-y-4">
      <p className="text-slate-500 text-xs font-mono">
        Notification preferences are managed per connected wallet address.
        {connected
          ? ` Currently configured for ${address?.slice(0, 6)}...${address?.slice(-4)}.`
          : " Connect a wallet to manage notification preferences."}
      </p>
      {connected && address && <NotificationPreferences address={address} />}
      {!connected && (
        <div className="bg-card border border-border rounded-lg p-6 text-center">
          <Bell className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400 text-xs font-mono">
            Connect your wallet to configure notification preferences
          </p>
        </div>
      )}
    </div>
  );
}

function DataPrivacySection() {
  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg p-4">
        <h4 className="text-sm font-bold font-mono uppercase text-white mb-2 flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          Local Storage
        </h4>
        <p className="text-slate-500 text-xs font-mono mb-4">
          TrusTrove stores preferences locally in your browser. No personal
          data is sent to external servers without your consent.
        </p>
        <button
          type="button"
          onClick={() => {
            if (
              confirm(
                "This will clear all locally stored preferences (theme, filters, saved searches, display settings). This cannot be undone.",
              )
            ) {
              try {
                Object.keys(window.localStorage).forEach((key) => {
                  if (key.startsWith("trusttrove:")) {
                    window.localStorage.removeItem(key);
                  }
                });
                alert("Local data cleared. Page will reload.");
                window.location.reload();
              } catch {
                alert("Failed to clear local data.");
              }
            }
          }}
          className="px-4 py-2 border border-red-500/40 text-red-400 rounded hover:bg-red-500/10 font-mono text-xs uppercase transition-colors"
        >
          Clear All Local Data
        </button>
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <h4 className="text-sm font-bold font-mono uppercase text-white mb-2 flex items-center gap-2">
          <Database className="w-4 h-4 text-primary" />
          Saved Marketplace Searches
        </h4>
        <p className="text-slate-500 text-xs font-mono mb-4">
          Your saved filter presets are stored locally and scoped to your
          connected wallet address (or a generic key when not connected).
          Maximum of 10 presets per address.
        </p>
        <p className="text-slate-400 text-[10px] font-mono">
          Manage presets from the <strong>Marketplace</strong> page.
        </p>
      </div>
    </div>
  );
}

  return (
    <PageLayout>
      <div className="max-w-4xl mx-auto space-y-8 py-4">
        {/* Header */}
        <div className="border-b border-border/40 pb-5">
          <h1 className="text-xl font-bold font-mono tracking-wider uppercase text-white">
            Settings
          </h1>
          <p className="text-slate-500 text-xs font-mono mt-1">
            Manage your application preferences. Settings are stored locally in
            your browser and scoped to your connected wallet where applicable.
          </p>
        </div>

        {/* Wallet Status */}
        {connected && address && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-primary" />
              <div>
                <p className="text-white font-bold font-mono text-xs uppercase">
                  Wallet Connected
                </p>
                <p className="text-slate-400 text-[10px] font-mono">
                  {address.slice(0, 6)}...{address.slice(-4)}
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[10px] font-bold font-mono tracking-widest uppercase rounded">
              Settings scoped to this address
            </span>
          </div>
        )}

        {/* Settings Sections */}
        <div className="space-y-6">
          <section
            className="bg-card border border-border rounded-xl p-6 space-y-4"
            aria-labelledby="section-appearance"
          >
            <header className="flex items-start gap-3 border-b border-border/40 pb-4">
              <Palette className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="flex-1">
                <h2
                  id="section-appearance"
                  className="text-lg font-bold font-mono tracking-wider uppercase text-white"
                >
                  Appearance
                </h2>
                <p className="text-slate-500 text-xs font-mono mt-1">
                  Customize how TrusTrove looks on your device
                </p>
              </div>
            </header>
            <div>
              <AppearanceSection />
            </div>
          </section>

          <section
            className="bg-card border border-border rounded-xl p-6 space-y-4"
            aria-labelledby="section-notifications"
          >
            <header className="flex items-start gap-3 border-b border-border/40 pb-4">
              <Bell className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="flex-1">
                <h2
                  id="section-notifications"
                  className="text-lg font-bold font-mono tracking-wider uppercase text-white"
                >
                  Notifications
                </h2>
                <p className="text-slate-500 text-xs font-mono mt-1">
                  Configure which events trigger notifications
                </p>
              </div>
            </header>
            <div>
              <NotificationsSection />
            </div>
          </section>

          <section
            className="bg-card border border-border rounded-xl p-6 space-y-4"
            aria-labelledby="section-data-privacy"
          >
            <header className="flex items-start gap-3 border-b border-border/40 pb-4">
              <Database className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="flex-1">
                <h2
                  id="section-data-privacy"
                  className="text-lg font-bold font-mono tracking-wider uppercase text-white"
                >
                  Data & Privacy
                </h2>
                <p className="text-slate-500 text-xs font-mono mt-1">
                  Manage local data storage and privacy settings
                </p>
              </div>
            </header>
            <div>
              <DataPrivacySection />
            </div>
          </section>
        </div>
      </div>
    </PageLayout>
  );
}

function NotificationPreferences({ address }: { address: string }) {
  const categories = [
    "Invoice Created",
    "Invoice Listed",
    "Invoice Funded",
    "Invoice Shipped",
    "Delivery Confirmed",
    "Invoice Repaid",
    "Invoice Defaulted",
  ];

  const storageKey = `trusttrove_prefs_${address}`;
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) return JSON.parse(stored);
    } catch {
      // Ignore storage errors
    }
    const initial: Record<string, boolean> = {};
    categories.forEach((c) => (initial[c] = true));
    return initial;
  });

  const toggleCategory = (category: string) => {
    const nextPrefs = { ...prefs, [category]: !prefs[category] };
    setPrefs(nextPrefs);
    try {
      localStorage.setItem(storageKey, JSON.stringify(nextPrefs));
    } catch {
      // Ignore storage errors
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
      {categories.map((category) => (
        <div
          key={category}
          className="flex items-center justify-between p-3 rounded-lg border border-border bg-[#0d131a]/50"
        >
          <span className="text-slate-300 font-bold">{category}</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={prefs[category] !== false}
              onChange={() => toggleCategory(category)}
            />
            <div className="w-9 h-5 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
          </label>
        </div>
      ))}
    </div>
  );
}