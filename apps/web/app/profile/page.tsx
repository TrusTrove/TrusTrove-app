'use client';

import React from 'react';
import { PageLayout } from '@/components/shared/PageLayout';
import { useWalletStore } from '@/store/wallet';

function getErrorMessage(error: unknown): string | null {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return null;
}

export default function ProfilePage() {
  const { address, connected, role } = useWalletStore();
  const registerError: unknown = null;
  const errorMessage = getErrorMessage(registerError);

  return (
    <PageLayout>
      <div className="mx-auto max-w-2xl space-y-6 py-8">
        <div className="border-b border-border/40 pb-5">
          <h1 className="text-xl font-bold font-mono uppercase tracking-wider text-white">
            Profile
          </h1>
          <p className="mt-1 text-xs font-mono text-slate-500">
            Manage your on-chain TrusTrove participant profile.
          </p>
        </div>

        {!connected ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center font-mono text-xs text-slate-400">
            Connect your wallet to view your profile.
          </div>
        ) : (
          <div className="space-y-4 rounded-lg border border-border bg-card p-6 font-mono">
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Wallet Address
              </span>
              <span className="mt-1 block break-all text-sm text-white">
                {address || '—'}
              </span>
            </div>

            <div className="border-t border-border/40 pt-4">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Role
              </span>
              <span className="mt-1 block text-sm uppercase text-primary">
                {role}
              </span>
            </div>

            {errorMessage && (
              <div className="rounded border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400">
                {errorMessage}
              </div>
            )}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
