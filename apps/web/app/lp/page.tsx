"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { PageLayout } from "@/components/shared/PageLayout";
import { usePool } from "@/hooks/usePool";
import { useWalletStore } from "@/store/wallet";
import { useProfile } from "@/hooks/useProfile";
import { useAppError } from "@/hooks/useAppError";
import { WalletConnect } from "@/components/shared/WalletConnect";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { AmountInput } from "@/components/shared/AmountInput";
import { Landmark, ShieldAlert } from "lucide-react";
import type { AssetType } from "@/types";
import { formatAmount } from "@/lib/assets";

interface PoolShareStats {
  sharePrice?: bigint | number | string;
  totalShares?: bigint | number | string;
}

const STROOPS_PER_USDC = 10_000_000;

function toNumber(value: bigint | number | string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = typeof value === "bigint" ? Number(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getCurrentSharePrice(
  stats: { totalDeposits?: bigint } | undefined,
): number | null {
  if (!stats) return null;

  const shareStats = stats as typeof stats & PoolShareStats;
  const explicitPrice = toNumber(shareStats.sharePrice);
  if (explicitPrice !== null && explicitPrice > 0) {
    return explicitPrice;
  }

  const totalShares = toNumber(shareStats.totalShares);
  const totalDeposits = toNumber(stats.totalDeposits);
  if (
    totalShares === null ||
    totalDeposits === null ||
    totalShares <= 0 ||
    totalDeposits < 0
  ) {
    return null;
  }

  return totalDeposits / totalShares;
}

export default function LPDashboard() {
  const { connected } = useWalletStore();
  const { isVerified } = useProfile();
  const {
    stats,
    isStatsLoading,
    deposit,
    isDepositing,
    withdraw,
    isWithdrawing,
  } = usePool();
  const {
    error: localError,
    setError: setLocalError,
    clearError: clearLocalError,
  } = useAppError();

  const [depositAmount, setDepositAmount] = useState("");
  const [depositAsset] = useState<AssetType>("USDC");
  const [withdrawShares, setWithdrawShares] = useState("");
  const [withdrawAsset] = useState<AssetType>("USDC");
  const [transactionError, setTransactionError] = useState<string | null>(null);

  const sharePrice = useMemo(() => getCurrentSharePrice(stats), [stats]);
  const parsedDeposit = Number(depositAmount);
  const parsedWithdraw = Number(withdrawShares);
  const validDeposit = Number.isFinite(parsedDeposit) && parsedDeposit > 0;
  const validWithdraw = Number.isFinite(parsedWithdraw) && parsedWithdraw > 0;

  const depositSharesPreview =
    sharePrice !== null && validDeposit ? parsedDeposit / sharePrice : undefined;
  const withdrawalUsdcPreview =
    sharePrice !== null && validWithdraw ? parsedWithdraw * sharePrice : undefined;

  const handleDeposit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearLocalError();
    setTransactionError(null);

    if (!validDeposit) {
      setLocalError("Please enter a valid deposit amount");
      return;
    }

    try {
      await deposit({
        amount: BigInt(Math.floor(parsedDeposit * STROOPS_PER_USDC)),
      });
      setDepositAmount("");
    } catch (error) {
      setTransactionError(
        error instanceof Error ? error.message : "Deposit transaction failed",
      );
    }
  };

  const handleWithdraw = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearLocalError();
    setTransactionError(null);

    if (!validWithdraw) {
      setLocalError("Please enter a valid shares amount to withdraw");
      return;
    }

    try {
      await withdraw({
        shares: BigInt(Math.floor(parsedWithdraw * STROOPS_PER_USDC)),
      });
      setWithdrawShares("");
    } catch (error) {
      setTransactionError(
        error instanceof Error ? error.message : "Withdrawal transaction failed",
      );
    }
  };

  if (!connected) {
    return (
      <PageLayout>
        <div className="flex min-h-[70vh] flex-col items-center justify-center py-20 text-center">
          <Landmark className="mb-6 h-12 w-12 text-primary" />
          <h1 className="mb-2 text-2xl font-bold uppercase text-white">
            Connect Your Wallet
          </h1>
          <p className="mb-8 max-w-md text-sm text-slate-400">
            Connect your wallet to supply USDC liquidity and manage LP shares.
          </p>
          <WalletConnect />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="mx-auto max-w-5xl space-y-8 py-4">
        <div className="border-b border-border/40 pb-5">
          <h1 className="text-xl font-bold uppercase tracking-wider text-white">
            Liquidity Provider Portal
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Supply USDC liquidity and earn yield from invoice financing.
          </p>
        </div>

        {!isVerified && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-xs text-amber-400">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <p>
              Profile verification is required for pool operations. Visit the{" "}
              <Link href="/profile" className="font-bold underline">
                profile page
              </Link>{" "}
              to register.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <span className="text-[10px] font-bold uppercase text-slate-500">
              Total Deposits
            </span>
            <strong className="mt-1 block text-lg text-white">
              {isStatsLoading ? "Syncing..." : formatAmount(stats?.totalDeposits)}
            </strong>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <span className="text-[10px] font-bold uppercase text-slate-500">
              Available Liquidity
            </span>
            <strong className="mt-1 block text-lg text-primary">
              {isStatsLoading
                ? "Syncing..."
                : formatAmount(stats?.availableLiquidity)}
            </strong>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <span className="text-[10px] font-bold uppercase text-slate-500">
              Current LP Share Price
            </span>
            <strong className="mt-1 block text-lg text-white">
              {sharePrice === null
                ? isStatsLoading
                  ? "Syncing..."
                  : "Unavailable"
                : `${sharePrice.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 8,
                  })} USDC`}
            </strong>
          </div>
        </div>

        {localError && (
          <p className="rounded border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
            {localError}
          </p>
        )}
        {transactionError && (
          <p className="rounded border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
            {transactionError}
          </p>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <form
            onSubmit={handleDeposit}
            className="space-y-5 rounded-lg border border-border bg-card p-6"
          >
            <h2 className="text-sm font-bold uppercase text-white">Deposit USDC</h2>
            <AmountInput
              value={depositAmount}
              onChange={setDepositAmount}
              asset={depositAsset}
              label="Deposit amount"
              required
              showPreview={depositSharesPreview !== undefined}
              previewValue={depositSharesPreview}
              previewLabel={
                depositSharesPreview === undefined
                  ? undefined
                  : `Estimated LP shares: ${depositSharesPreview.toLocaleString(
                      "en-US",
                      { maximumFractionDigits: 8 },
                    )}`
              }
            />
            <p className="text-[11px] text-slate-500">
              {sharePrice === null
                ? "LP share estimate will appear when the current pool share price is available."
                : `Preview uses the current pool share price of ${sharePrice.toLocaleString(
                    "en-US",
                    { maximumFractionDigits: 8 },
                  )} USDC per share.`}
            </p>
            <Button
              type="submit"
              disabled={!isVerified || isDepositing || sharePrice === null}
              className="w-full"
            >
              {isDepositing ? "Depositing..." : "Deposit USDC"}
            </Button>
          </form>

          <form
            onSubmit={handleWithdraw}
            className="space-y-5 rounded-lg border border-border bg-card p-6"
          >
            <h2 className="text-sm font-bold uppercase text-white">Withdraw LP Shares</h2>
            <AmountInput
              value={withdrawShares}
              onChange={setWithdrawShares}
              asset={withdrawAsset}
              label="LP shares"
              required
              showPreview={withdrawalUsdcPreview !== undefined}
              previewValue={withdrawalUsdcPreview}
              previewLabel={
                withdrawalUsdcPreview === undefined
                  ? undefined
                  : `Estimated USDC: ${withdrawalUsdcPreview.toLocaleString(
                      "en-US",
                      { maximumFractionDigits: 8 },
                    )}`
              }
            />
            <p className="text-[11px] text-slate-500">
              Withdrawal estimates use the current pool share price and may
              change as pool assets and shares change.
            </p>
            <Button
              type="submit"
              disabled={!isVerified || isWithdrawing || sharePrice === null}
              className="w-full"
            >
              {isWithdrawing ? "Withdrawing..." : "Withdraw USDC"}
            </Button>
          </form>
        </div>
      </div>
    </PageLayout>
  );
}
