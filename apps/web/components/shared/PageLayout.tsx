import React from "react";
import { Navbar } from "./Navbar";

interface PageLayoutProps {
  children: React.ReactNode;
}

export function PageLayout({ children }: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-hidden">
      {/* Decorative glows: token colours at low opacity so they read as a
          subtle vignette on the dark theme and as a faint tint on the light
          one, instead of a fixed dark-blue smear (#1008). */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[60%] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[55%] h-[55%] rounded-full bg-secondary/10 blur-[130px] pointer-events-none" />

      <Navbar />

      <main
        id="main-content"
        // The root layout's skip link points here. A `<main>` is not focusable
        // on its own, so activating the link scrolls without moving keyboard
        // focus, and the user's next Tab returns to the top of the page.
        tabIndex={-1}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow w-full z-10 relative focus:outline-none"
      >
        {children}
      </main>

      <footer className="border-t border-border z-10 py-6 text-center text-xs text-muted-foreground font-mono">
        <div className="max-w-7xl mx-auto px-4">
          <p>
            © {new Date().getFullYear()} TrusTrove. Built on Stellar Soroban
            Smart Contracts.
          </p>
        </div>
      </footer>
    </div>
  );
}
