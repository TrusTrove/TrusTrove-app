import Link from "next/link";
import { FileQuestion, Home, ListChecks } from "lucide-react";

export default function NotFound() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-screen flex items-center justify-center bg-background text-foreground px-4 focus:outline-none"
    >
      <div className="w-full max-w-md text-center bg-card border border-border rounded-lg p-8">
        <div className="flex justify-center mb-5">
          <div className="w-14 h-14 rounded-full bg-muted border border-border flex items-center justify-center">
            <FileQuestion className="w-7 h-7 text-primary" />
          </div>
        </div>

        <h1 className="text-2xl font-bold font-mono text-foreground mb-2">
          404
        </h1>
        <p className="text-sm text-muted-foreground mb-1">
          This page doesn&apos;t exist.
        </p>
        <p className="text-xs text-muted-foreground font-mono mb-6">
          The route you tried to reach isn&apos;t part of TrusTrove.
        </p>

        <div className="flex flex-col gap-2">
          <Link
            href="/"
            className="w-full font-bold uppercase tracking-wider text-xs rounded py-2.5 flex items-center justify-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground transition-all"
          >
            <Home className="w-3.5 h-3.5" />
            Go Home
          </Link>

          <Link
            href="/marketplace"
            className="w-full font-bold uppercase tracking-wider text-xs rounded py-2.5 flex items-center justify-center gap-1.5 border border-border bg-transparent hover:bg-muted text-foreground transition-all"
          >
            <ListChecks className="w-3.5 h-3.5" />
            View Invoices
          </Link>
        </div>
      </div>
    </main>
  );
}
