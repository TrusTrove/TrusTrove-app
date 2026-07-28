'use client';

import React, { useState } from 'react';
import { PageLayout } from '@/components/shared/PageLayout';
import { WalletConnect } from '@/components/shared/WalletConnect';
import { useWalletStore } from '@/store/wallet';
import { ShieldCheck, UserRound } from 'lucide-react';

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.length > 0
  ) {
    return error.message;
  }

  return fallback;
}

export default function ProfilePage() {
  const { address, connected, role } = useWalletStore();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleProfileAction = async (action: () => Promise<void>, fallback: string) => {
    setError(null);
    setMessage(null);

    try {
      await action();
      setMessage('Profile updated successfully.');
    } catch (err: unknown) {
      setError(getErrorMessage(err, fallback));
    }
  };

  const handleVerification = async () => {
    await handleProfileAction(
      async () => {
        await Promise.resolve();
      },
      'Profile verification failed',
    );
  };

  const handleRefresh = async () => {
    await handleProfileAction(
      async () => {
        await Promise.resolve();
      },
      'Unable to refresh profile',
    );
  };

  if (!connected) {
    return (
      <PageLayout>
        <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
          <UserRound className="mb-6 h-12 w-12 text-primary" />
          <h1 className="mb-2 font-mono text-2xl font-bold uppercase text-white">Connect Your Wallet</h1>
          <p className="mb-8 max-w-md font-mono text-xs leading-relaxed text-slate-400">
            Connect your Freighter wallet to view and manage your on-chain profile.
          </p>
          <WalletConnect />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="mx-auto max-w-2xl space-y-6 py-4">
        <div className="border-b border-border/40 pb-5">
          <h1 className="font-mono text-xl font-bold uppercase tracking-wider text-white">Profile</h1>
          <p className="mt-1 font-mono text-xs text-slate-500">
            Manage your decentralized identity and verification status.
          </p>
        </div>

        {error && (
          <div className="rounded border border-rose-500/20 bg-rose-500/10 p-3 font-mono text-xs text-rose-400">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded border border-emerald-500/20 bg-emerald-500/10 p-3 font-mono text-xs text-emerald-400">
            {message}
          </div>
        )}

        <section className="space-y-5 rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-3 border-b border-border/40 pb-4">
            <div className="rounded-lg border border-primary/20 bg-primary/10 p-3 text-primary">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-mono text-sm font-bold uppercase text-white">On-chain identity</h2>
              <p className="mt-1 font-mono text-[10px] uppercase text-slate-500">Wallet profile record</p>
            </div>
          </div>

          <div className="space-y-4 font-mono text-xs">
            <div>
              <span className="block text-[10px] font-bold uppercase text-slate-500">Wallet address</span>
              <span className="mt-1 block break-all text-slate-300">{address}</span>
            </div>
            <div className="flex justify-between border-t border-border/30 pt-4">
              <span className="text-slate-500">Role</span>
              <span className="font-bold uppercase text-primary">{role}</span>
            </div>
            <div className="flex justify-between border-t border-border/30 pt-4">
              <span className="text-slate-500">Verification</span>
              <span className="font-bold text-amber-400">Pending</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-border/30 pt-5 sm:flex-row">
            <button
              type="button"
              onClick={handleVerification}
              className="rounded bg-primary px-4 py-2.5 font-mono text-xs font-bold uppercase text-black transition-colors hover:bg-primary-hover"
            >
              Request verification
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              className="rounded border border-border px-4 py-2.5 font-mono text-xs font-bold uppercase text-slate-300 transition-colors hover:border-primary/50 hover:text-white"
            >
              Refresh profile
            </button>
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
