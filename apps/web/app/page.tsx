import type { Metadata } from "next";
import Link from "next/link";
import { TopStatusBar } from "@/components/shared/TopStatusBar";
import { Navbar } from "@/components/shared/Navbar";
import { InvoiceFeed } from "@/components/shared/InvoiceFeed";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { HeroStats } from "@/components/shared/HeroStats";
import { PillarStat } from "@/components/shared/PillarStat";
import {
  HomeDiscountCalculator,
  HomeLpCalculator,
} from "@/components/shared/HomePanels";
import {
  ShieldCheck,
  FileCheck2,
  Layers,
  Coins,
  Database,
  ArrowRightLeft,
  Landmark,
} from "lucide-react";

export const metadata: Metadata = {
  title: "TrusTrove | Decentralized Trade Finance Operations Terminal",
  description:
    "Tokenize unpaid trade invoices as Stellar assets and receive immediate USDC funding. Yield opportunities for liquidity providers.",
};

const specificationUrl = "https://k1ngd4vid.gitbook.io/trustrove/";
const stellarExpertUrl = process.env.NEXT_PUBLIC_POOL_CONTRACT_ID
  ? `https://stellar.expert/explorer/testnet/contract/${process.env.NEXT_PUBLIC_POOL_CONTRACT_ID}`
  : "https://stellar.expert/explorer/testnet";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary selection:text-primary-foreground">
      {/* Top Status Bar with scrolling ticker */}
      <TopStatusBar />

      {/* Main navigation */}
      <Navbar />

      {/* Hero Section */}
      <main
        id="main-content"
        className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-20 relative"
      >
        {/* Subtle grid background pattern — border token so the grid lines
            follow the theme instead of staying dark on light (#1009) */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] -z-10 opacity-20 pointer-events-none" />

        {/* 3-Column Split Hero */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-4 items-start">
          {/* LEFT: Live Invoice Financing Feed */}
          <div className="lg:col-span-3 space-y-3">
            <ErrorBoundary context="InvoiceFeed">
              <InvoiceFeed />
            </ErrorBoundary>
            <div className="bg-card border border-border rounded-lg p-4 font-mono text-[10px] text-muted-foreground leading-normal">
              <span className="text-primary font-bold block mb-1">
                STELLAR INTEGRATION
              </span>
              Every entry represents a cryptographically secure, on-chain event
              emitted by the Soroban network and synced by our indexer.
            </div>
          </div>

          {/* CENTER: Core Stats & Value Prop */}
          <div className="lg:col-span-5 text-center lg:text-left space-y-8 py-4 px-2">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold font-mono tracking-widest uppercase rounded">
                DECENTRALIZED TRADE FINANCE
              </span>
              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground leading-tight font-mono uppercase">
                ELIMINATE THE <br className="hidden sm:inline" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-600 dark:to-emerald-400">
                  $2.5 TRILLION
                </span>{" "}
                <br />
                TRADE FINANCE GAP
              </h1>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-xl">
                TrusTrove tokenizes outstanding trade obligations on Stellar.
                SMEs secure immediate working capital at fair rates, and
                liquidity providers earn direct yield.
              </p>
            </div>

            <HeroStats />

            <div className="text-xs font-mono text-muted-foreground border-l-2 border-primary pl-3">
              &ldquo;From invoice to USDC in minutes. Not weeks.&rdquo;
            </div>
          </div>

          {/* RIGHT: LP Yield Calculator */}
          <div className="lg:col-span-4">
            <HomeLpCalculator />
          </div>
        </div>

        {/* How It Works Timeline */}
        <div className="space-y-8 border-t border-border/30 pt-16">
          <div className="text-center space-y-2">
            <p
              className="text-xs font-bold font-mono text-primary uppercase tracking-widest"
              aria-hidden="true"
            >
              PROTOCOL WORKFLOW
            </p>
            <h2 className="text-xl font-bold font-mono text-foreground uppercase">
              HOW TRUSTROVE ELIMINATES MIDDLEMEN
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
            {/* Step 1 */}
            <div className="bg-card border border-border p-5 rounded-lg relative space-y-3">
              <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mb-1">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold font-mono text-foreground uppercase tracking-wider">
                1. REGISTER AS SME
              </h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Verify your business identity on-chain via the registry contract
                to establish trusted credentials.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-card border border-border p-5 rounded-lg relative space-y-3">
              <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mb-1">
                <FileCheck2 className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold font-mono text-foreground uppercase tracking-wider">
                2. TOKENIZE INVOICE
              </h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Generate a unique invoice cryptographic hash on-chain
                representing your commercial shipment.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-card border border-border p-5 rounded-lg relative space-y-3">
              <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mb-1">
                <Coins className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold font-mono text-foreground uppercase tracking-wider">
                3. RECEIVE USDC LIQUIDITY
              </h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Pool contract immediately funds the invoice at the agreed
                discount rate directly into your wallet.
              </p>
            </div>

            {/* Step 4 */}
            <div className="bg-card border border-border p-5 rounded-lg relative space-y-3">
              <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mb-1">
                <Landmark className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold font-mono text-foreground uppercase tracking-wider">
                4. BUYER MATURITY SETTLEMENT
              </h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Buyer pays full invoice face value to the pool upon due date,
                releasing escrow and yielding LP interest.
              </p>
            </div>
          </div>
        </div>

        {/* Three Protocol Pillars */}
        <div className="space-y-8 pt-8">
          <div className="text-center space-y-2">
            <p
              className="text-xs font-bold font-mono text-primary uppercase tracking-widest"
              aria-hidden="true"
            >
              SYSTEM ARCHITECTURE
            </p>
            <h2 className="text-xl font-bold font-mono text-foreground uppercase">
              SOROBAN SMART CONTRACT PIPELINE
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {/* Pillar 1 */}
            <div className="bg-card border border-border p-6 rounded-lg space-y-4">
              <div className="flex items-center gap-2 border-b border-border/40 pb-3">
                <Database className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-bold font-mono text-foreground uppercase tracking-wider">
                  REGISTRY_CONTRACT
                </h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Manages decentralized profiles and KYC verification status for
                issuers and buyers.
              </p>
              <div className="bg-background border border-border/40 p-2.5 rounded text-[10px] font-mono flex justify-between text-muted-foreground">
                <span>VERIFIED ISSUERS:</span>
                <PillarStat kind="issuers" />
              </div>
            </div>

            {/* Pillar 2 */}
            <div className="bg-card border border-border p-6 rounded-lg space-y-4">
              <div className="flex items-center gap-2 border-b border-border/40 pb-3">
                <Layers className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-bold font-mono text-foreground uppercase tracking-wider">
                  INVOICE_CONTRACT
                </h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Stores tokenized invoices, discount rates, status lifecycle
                events, and compliance signatures.
              </p>
              <div className="bg-background border border-border/40 p-2.5 rounded text-[10px] font-mono flex justify-between text-muted-foreground">
                <span>TOTAL OBLIGATIONS:</span>
                <PillarStat kind="invoices" />
              </div>
            </div>

            {/* Pillar 3 */}
            <div className="bg-card border border-border p-6 rounded-lg space-y-4">
              <div className="flex items-center gap-2 border-b border-border/40 pb-3">
                <ArrowRightLeft className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-bold font-mono text-foreground uppercase tracking-wider">
                  POOL & ESCROW
                </h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Controls USDC liquidity deposits, share-based yield parameters,
                and locks obligations securely in escrow.
              </p>
              <div className="bg-background border border-border/40 p-2.5 rounded text-[10px] font-mono flex justify-between text-muted-foreground">
                <span>UTILIZATION RATE:</span>
                <PillarStat kind="utilization" />
              </div>
            </div>
          </div>
        </div>

        {/* Economic Calculator Section */}
        <div className="space-y-6 pt-8 pb-16">
          <div className="space-y-1">
            <p
              className="text-xs font-bold font-mono text-primary uppercase tracking-widest"
              aria-hidden="true"
            >
              FINANCIAL FEASIBILITY
            </p>
            <h2 className="text-lg font-bold font-mono text-foreground uppercase">
              INTERACTIVE ECONOMIC COMPILER
            </h2>
          </div>
          <HomeDiscountCalculator />
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-border bg-background py-8 text-center text-xs font-mono text-muted-foreground">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <span>© 2026 TRUSTROVE PROTOCOL — VERIFIED TRADE FINANCE</span>
          <div className="flex gap-4">
            <a
              href={specificationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors"
            >
              SPECIFICATION
            </a>
            <a
              href={stellarExpertUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors"
            >
              STELLAR EXPERT
            </a>
            <Link href="/docs" className="hover:text-primary transition-colors">
              DOCUMENTATION
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
