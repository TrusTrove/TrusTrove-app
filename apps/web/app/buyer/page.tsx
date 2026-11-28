"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageLayout } from "@/components/shared/PageLayout";
import { WalletConnect } from "@/components/shared/WalletConnect";
import { InvoiceCard } from "@/components/invoice/InvoiceCard";
import { SkeletonShimmer } from "@/components/shared/SkeletonLoader";
import { useBuyerInvoices } from "@/hooks/useBuyerInvoices";
import { useWalletStore } from "@/store/wallet";
import { formatAmount } from "@/lib/assets";
import { ClipboardCheck, ShoppingBag } from "lucide-react";

/**
 * Buyer-facing invoice workspace (#1201).
 *
 * A connected buyer sees only the invoices addressed to their wallet, grouped
 * by the next action they enable: overdue repayment, repayment, delivery
 * confirmation, shipment, financing, and closed. Every entry opens the
 * existing invoice detail flow and carries the same inline actions the
 * buyer sees elsewhere in the app.
 */
export default function BuyerWorkspacePage() {
  const router = useRouter();
  const connected = useWalletStore((s) => s.connected);
  const address = useWalletStore((s) => s.address);
  const { groups, invoices, actionableCount, isLoading, error, refetch } =
    useBuyerInvoices(address);

  if (!connected) {
    return (
      <PageLayout>
        <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 text-center">
          <div className="rounded-lg border border-primary/20 bg-primary/10 p-4 text-primary">
            <ShoppingBag className="h-10 w-10" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold uppercase tracking-wider text-foreground">
              Connect Your Wallet
            </h1>
            <p className="max-w-md text-xs text-muted-foreground">
              The buyer workspace shows the invoices addressed to your Stellar
              account, grouped by what needs your confirmation or repayment.
            </p>
          </div>
          <WalletConnect />
        </div>
      </PageLayout>
    );
  }

  const outstanding = invoices
    .filter(
      (invoice) =>
        invoice.status === "Funded" ||
        invoice.status === "Active" ||
        invoice.status === "Confirmed",
    )
    .reduce((total, invoice) => total + invoice.faceValue, 0n);

  return (
    <PageLayout>
      <div className="mx-auto max-w-5xl space-y-8 py-4">
        <header className="flex flex-col gap-4 border-b border-border/40 pb-5 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <h1 className="text-xl font-bold uppercase tracking-wider text-foreground">
              Buyer Workspace
            </h1>
            <p className="text-xs text-muted-foreground">
              Invoices addressed to this wallet, grouped by your next action.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-4 text-right font-mono">
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Needs action
              </dt>
              <dd className="text-lg font-bold text-primary">
                {actionableCount}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Outstanding
              </dt>
              <dd className="text-lg font-bold text-foreground">
                {formatAmount(outstanding)}
              </dd>
            </div>
          </dl>
        </header>

        {error ? (
          <div
            role="alert"
            className="flex flex-col items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive"
          >
            <p>
              Could not load your invoices. Check the connection and try again.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="rounded border border-destructive/40 px-3 py-1.5 font-bold uppercase tracking-wider"
            >
              Retry
            </button>
          </div>
        ) : isLoading ? (
          <div className="space-y-3" role="status" aria-live="polite">
            <span className="sr-only">Loading buyer invoices</span>
            <SkeletonShimmer className="h-24 w-full" />
            <SkeletonShimmer className="h-24 w-full" />
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card/45 px-6 py-16 text-center">
            <ClipboardCheck
              className="h-9 w-9 text-muted-foreground"
              aria-hidden="true"
            />
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
              No invoices assigned to you
            </h2>
            <p className="max-w-md text-xs text-muted-foreground">
              When an issuer addresses an invoice to this wallet it appears here
              with the confirmation or repayment it needs.
            </p>
            <Link
              href="/marketplace"
              className="rounded border border-border px-4 py-2 text-xs font-bold uppercase tracking-wider text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              Browse the marketplace
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map((group) => (
              <section
                key={group.key}
                aria-labelledby={`buyer-group-${group.key}`}
                className="space-y-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2
                    id={`buyer-group-${group.key}`}
                    className="text-sm font-bold uppercase tracking-wider text-foreground"
                  >
                    {group.title}
                  </h2>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {group.invoices.length}{" "}
                    {group.invoices.length === 1 ? "invoice" : "invoices"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {group.description}
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  {group.invoices.map((invoice) => (
                    <div key={invoice.id} className="space-y-2">
                      <InvoiceCard
                        invoice={invoice}
                        role="buyer"
                        onSelect={() => router.push(`/invoice/${invoice.id}`)}
                      />
                      <Link
                        href={`/invoice/${invoice.id}`}
                        className="block rounded border border-border bg-card px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                      >
                        Open invoice details
                      </Link>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
