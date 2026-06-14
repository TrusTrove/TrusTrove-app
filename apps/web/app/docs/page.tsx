'use client';

import React from 'react';
import { Navbar } from '@/components/shared/Navbar';
import { TopStatusBar } from '@/components/shared/TopStatusBar';
import { ExternalLink, Terminal } from 'lucide-react';

export default function DocsPage() {
  const docUrl = 'https://trustrove.gitbook.io/trustrove';

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary selection:text-black">
      {/* Top Status Bar */}
      <TopStatusBar />
      
      {/* Main navigation */}
      <Navbar />
      
      {/* Terminal Document Reader Header */}
      <div className="border-b border-border bg-[#080d14] px-6 py-3 flex items-center justify-between font-mono text-xs">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-primary animate-pulse" />
          <span className="text-white font-bold uppercase tracking-widest">
            SYSTEM_MODULE: DOCUMENTS_READER.EXE
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider hidden sm:inline">
            SOURCE: trustrove.gitbook.io
          </span>
          <a 
            href={docUrl} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 border border-primary/20 hover:border-primary/50 text-primary rounded transition-all font-bold"
          >
            <span>Open in GitBook</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Embedded GitBook Viewer */}
      <div className="flex-1 w-full bg-[#05080c] relative min-h-[500px]">
        {/* Subtle grid background mask behind iframe */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1a2330_1px,transparent_1px),linear-gradient(to_bottom,#1a2330_1px,transparent_1px)] bg-[size:4rem_4rem] -z-10 opacity-5 pointer-events-none" />
        <iframe 
          src={docUrl} 
          className="w-full h-[calc(100vh-140px)] min-h-[600px] border-none"
          title="TrusTrove GitBook Documentation"
          allow="clipboard-write"
        />
      </div>
    </div>
  );
}
