'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/shared/Navbar';
import { TopStatusBar } from '@/components/shared/TopStatusBar';
import { BookOpen, Terminal, ExternalLink, Loader2 } from 'lucide-react';

export default function DocsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<string[]>([]);
  const [bootFinished, setBootFinished] = useState(false);
  const docUrl = 'https://k1ngd4vid.gitbook.io/trustrove/';

  // Navigate only on explicit user action — no forced/auto redirects.
  const goToDocs = () => {
    router.push(docUrl);
  };

  useEffect(() => {
    const logMessages = [
      'INITIATING SECURE DOCS DISPATCH ROUTER...',
      'RESOLVING SYSTEM ROUTE: /docs',
      'ESTABLISHING CONNECTION WITH GITBOOK PROTOCOL...',
      'FEDERATED SPACE IDENTIFIED: TrusTrove Docs',
      'EXTERNAL GATEWAY SECURED: k1ngd4vid.gitbook.io',
      'DELEGATING TRAFFIC TO SECURE SOURCE...'
    ];

    let currentLogIndex = 0;
    const logInterval = setInterval(() => {
      if (currentLogIndex < logMessages.length) {
        setLogs(prev => [...prev, logMessages[currentLogIndex]]);
        currentLogIndex++;
      } else {
        clearInterval(logInterval);
        setBootFinished(true);
      }
    }, 350);

    return () => clearInterval(logInterval);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary selection:text-black">
      {/* Top Status Bar */}
      <TopStatusBar />
      
      {/* Main navigation */}
      <Navbar />

      {/* Main content grid */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-16 flex flex-col justify-center items-center relative">
        {/* Subtle grid background pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1a2330_1px,transparent_1px),linear-gradient(to_bottom,#1a2330_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] -z-10 opacity-25 pointer-events-none" />

        {/* Terminal Interstitial Card */}
        <div className="w-full max-w-xl bg-[#080d14]/90 border border-border rounded-lg shadow-2xl p-6 font-mono relative overflow-hidden terminal-grid">
          {/* Header Panel */}
          <div className="flex items-center justify-between border-b border-border/60 pb-4 mb-6">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-primary animate-pulse" />
              <span className="text-xs font-bold text-white tracking-widest uppercase">
                SYSTEM MODULE: ROUTING_GATEWAY
              </span>
            </div>
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/40"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-500/40"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-primary/20 border border-primary/40"></span>
            </div>
          </div>

          {/* Console Boot Sequence */}
          <div className="min-h-[160px] bg-[#03060a] border border-border/40 rounded p-4 text-[11px] leading-relaxed text-slate-400 space-y-1 mb-6">
            {logs.map((log, idx) => (
              <div key={idx} className="flex gap-2">
                <span className="text-slate-600 font-bold select-none">[LOG_{idx}]</span>
                <span className={idx === logs.length - 1 && !bootFinished ? "text-primary" : "text-slate-300"}>
                  {log}
                </span>
              </div>
            ))}
            {!bootFinished && (
              <>
                <div className="flex items-center gap-2 pt-1">
                  <Loader2 className="w-3 h-3 text-primary animate-spin" />
                  <span className="text-primary tracking-widest select-none">RESOLVING...</span>
                </div>
                <div className="pt-3">
                  <button
                    onClick={goToDocs}
                    className="text-[10px] text-primary/70 hover:text-primary underline underline-offset-2 transition-colors uppercase tracking-wider"
                  >
                    [Skip to Docs]
                  </button>
                </div>
              </>
            )}
            {bootFinished && (
              <div className="text-primary font-bold pt-2 select-none">
                ✓ HANDSHAKE RESOLVED. READY WHEN YOU ARE.
              </div>
            )}
          </div>

          {/* User Interactivity Card */}
          <div className="bg-[#0c1420] border border-border/80 rounded-lg p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all duration-300 hover:border-primary/55">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-md text-primary">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white tracking-wide uppercase">
                  TrusTrove GitBook
                </h2>
                <p className="text-[11px] text-slate-500 mt-1 max-w-[280px]">
                  Protocol mechanics, economic modeling, smart contracts, and developer references.
                </p>
              </div>
            </div>

            <button
              onClick={goToDocs}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-[#0d131a] text-xs font-bold uppercase rounded transition-colors cursor-pointer"
            >
              <span>Access Docs</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Footer Status */}
          <div className="flex items-center justify-between text-[9px] text-slate-600 mt-6 pt-3 border-t border-border/40 select-none">
            <span>SECURE GATEWAY ENFORCED</span>
            <span>STATUS: ACTIVE</span>
          </div>
        </div>
      </main>
    </div>
  );
}
