"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { PageLayout } from "@/components/shared/PageLayout";
import { usePool } from "@/hooks/usePool";
import { useWalletStore } from "@/store/wallet";
import { useProfile } from "@/hooks/useProfile";
import { useAppError } from "@/hooks/useAppError";
import { WalletConnect } from "@/components/shared/WalletConnect";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import {
  LPPositionCardSkeleton,
  PoolStatsPanelSkeleton,
} from "@/components/shared/SkeletonLoader";
import { Button } from "@/components/ui/button";
import { AmountInput } from "@/components/shared/AmountInput";
import { Landmark, ShieldAlert, Wallet } from "lucide-react";
import type { AssetType } from "@/types";
import { formatAmount } from "@/lib/assets";
import { PoolClient } from "@trusttrove/sdk";
import { Address, nativeToScVal } from "@stellar/stellar-sdk";
import { SimulationPreview } from "@/components/shared/SimulationPreview";

const TransactionPending = dynamic(
  () =>
    import("@/components/shared/TransactionPending").then(
      (module) => module.TransactionPending,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-primary" />
      </div>
    ),
  },
);

const poolContractID = process.env.NEXT_PUBLIC_POOL_CONTRACT_ID || "";

type SimulationDetails = {
  estimatedFeeXlm: string;
  functionName: string;
  expectedResult: unknown;
  footprintSize: number;
};

type StatsWithSharePrice = {
  sharePrice?: bigint | number | string;
};

function formatSharePrice(
  value: bigint | number | string | undefined,
): number | null {
  if (value === undefined) return null;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return null;
  return typeof value === "bigint" || numericValue >= 10_000_000
    ? numericValue / 10_000_000
    : numericValue;
}

export default function LPDashboard() {
  const { connected, address } = useWalletStore();
  const { isVerified } = useProfile();
  const {
    stats,
    isStatsLoading,
    position,
    isPositionLoading,
    deposit,
    isDepositing,
    withdraw,
    isWithdrawing,
  } = usePool();
  const { setError: setLocalError, clearError: clearLocalError } =
    useAppError();

  const [depositAmount, setDepositAmount] = useState("");
  const [depositAsset] = useState<AssetType>("USDC");
  const [withdrawShares, setWithdrawShares] = useState("");
  const [withdrawAsset] = useState<AssetType>("USDC");
  const [showPending, setShowPending] = useState(false);
  const [pendingHash, setPendingHash] = useState<string | null>(null);
  const [pendingText, setPendingText] = useState("Waiting for confirmation...");
  const [simDetails, setSimDetails] = useState<SimulationDetails | null>(null);
  const [simError, setSimError] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [withdrawSimDetails, setWithdrawSimDetails] =
    useState<SimulationDetails | null>(null);
  const [withdrawSimError, setWithdrawSimError] = useState<string | null>(null);
  const [isWithdrawSimulating, setIsWithdrawSimulating] = useState(false);

  useEffect(() => {
    const amount = Number(depositAmount);
    if (!address || !Number.isFinite(amount) || amount <= 0) {
      setSimDetails(null);
      setSimError(null);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setIsSimulating(true);
      setSimError(null);

      try {
        const poolClient = new PoolClient(poolContractID);
        const args = [
          new Address(address).toScVal(),
          nativeToScVal(BigInt(Math.floor(amount * 10_000_000)), {
            type: "u128",
          }),
        ];
        const result = await poolClient.simulateTransaction(
          "deposit",
          args,
          address,
        );
        if (active) setSimDetails(result);
      } catch (error) {
        if (active) {
          setSimError(
            error instanceof Error ? error.message : "Simulation failed",
          );
        }
      } finally {
        if (active) setIsSimulating(false);
      }
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [address, depositAmount]);

  useEffect(() => {
    const shares = Number(withdrawShares);
    if (!address || !Number.isFinite(shares) || shares <= 0) {
      setWithdrawSimDetails(null);
      setWithdrawSimError(null);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setIsWithdrawSimulating(true);
      setWithdrawSimError(null);

      try {
        const poolClient = new PoolClient(poolContractID);
        const args = [
          new Address(address).toScVal(),
          nativeToScVal(BigInt(Math.floor(shares * 10_000_000)), {
            type: "u128",
          }),
        ];
        const result = await poolClient.simulateTransaction(
          "withdraw",
          args,
          address,
        );
        if (active) setWithdrawSimDetails(result);
      } catch (error) {
        if (active) {
          setWithdrawSimError(
            error instanceof Error ? error.message : "Simulation failed",
          );
        }
      } finally {
        if (active) setIsWithdrawSimulating(false);
      }
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [address, withdrawShares]);

  const handleDeposit = async (event: React.FormEvent) => {
    event.preventDefault();
    clearLocalError();
    const amount = Number(depositAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setLocalError("Please enter a valid deposit amount");
      return;
    }

    try {
      const amountStroops = BigInt(Math.floor(amount * 10_000_000));
      const poolClient = new PoolClient(poolContractID);
      const args = [
        new Address(address!).toScVal(),
        nativeToScVal(amountStroops, { type: "u128" }),
      ];
      await poolClient.simulateTransaction("deposit", args, address!);

      setPendingText(`Depositing ${depositAsset} into pool...`);
      setPendingHash(null);
      setShowPending(true);

      const result = await deposit({ amount: amountStroops });
      if (typeof result === "string") setPendingHash(result);
      setDepositAmount("");
    } catch {
      setShowPending(false);
    }
  };

  const handleWithdraw = async (event: React.FormEvent) => {
    event.preventDefault();
    clearLocalError();
    const shares = Number(withdrawShares);
    if (!Number.isFinite(shares) || shares <= 0) {
      setLocalError("Please enter a valid shares amount to withdraw");
      return;
    }

    setPendingText("Redeeming LP shares...");
    setPendingHash(null);
    setShowPending(true);

    try {
      const result = await withdraw({
        shares: BigInt(Math.floor(shares * 10_000_000)),
      });
      setPendingHash(result);
      setWithdrawShares("");
    } catch {
      setShowPending(false);
    }
  };

  if (!connected) {
    return (
      <PageLayout>
        <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center py-20 text-center">
          <Landmark className="mb-6 h-12 w-12 text-primary" />
          <h1 className="mb-2 text-2xl font-bold uppercase tracking-wider text-white">
            Connect Your Wallet
          </h1>
          <p className="mb-8 text-xs leading-relaxed text-slate-400">
            Connect your Freighter wallet to access the Liquidity Pool Portal,
            supply USDC, and earn yield.
          </p>
          <WalletConnect />
        </div>
      </PageLayout>
    );
  }

  const statsWithSharePrice = stats as typeof stats & StatsWithSharePrice;
  const sharePrice = formatSharePrice(statsWithSharePrice?.sharePrice);
  const parsedDeposit = Number(depositAmount) || 0;
  const parsedWithdraw = Number(withdrawShares) || 0;
  const depositPreview =
    sharePrice === null ? undefined : parsedDeposit / sharePrice;
  const withdrawalPreview =
    sharePrice === null ? undefined : parsedWithdraw * sharePrice;

  return (
    <PageLayout>
      <div className="space-y-8 py-4">
        <div className="border-b border-border/40 pb-5">
          <h1 className="text-xl font-bold uppercase tracking-wider text-white">
            Liquidity Provider Portal
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Supply USDC liquidity to automate invoice discounting and capture
            trade yield.
          </p>
        </div>

        {!isVerified && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-xs text-amber-400">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <p>
              Your profile is not verified. Visit the{" "}
              <Link href="/profile" className="font-bold underline">
                Profile Page
              </Link>{" "}
              to register before supplying liquidity or redeeming shares.
            </p>
          </div>
        )}

        <ErrorBoundary context="PoolStatsPanel">
          {isStatsLoading ? (
            <PoolStatsPanelSkeleton />
          ) : (
            <div className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-5 font-mono md:grid-cols-4">
              <div>
                <span className="block text-[10px] uppercase text-slate-500">
                  Total Deposits
                </span>
                <strong className="mt-1 block text-white">
                  {formatAmount(stats?.totalDeposits)}
                </strong>
              </div>
              <div>
                <span className="block text-[10px] uppercase text-slate-500">
                  Available Liquidity
                </span>
                <strong className="mt-1 block text-primary">
                  {formatAmount(stats?.availableLiquidity)}
                </strong>
              </div>
              <div>
                <span className="block text-[10px] uppercase text-slate-500">
                  Yield Distributed
                </span>
                <strong className="mt-1 block text-emerald-400">
                  {formatAmount(stats?.totalYieldDistributed)}
                </strong>
              </div>
              <div>
                <span className="block text-[10px] uppercase text-slate-500">
                  LP Share Price
                </span>
                <strong className="mt-1 block text-primary">
                  {sharePrice === null
                    ? "Syncing..."
                    : `${sharePrice.toFixed(7)} USDC`}
                </strong>
              </div>
            </div>
          )}
        </ErrorBoundary>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <form
            onSubmit={handleDeposit}
            className="space-y-4 rounded-lg border border-border bg-card p-5"
          >
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              <h2 className="font-mono text-sm font-bold uppercase text-white">
                Supply Liquidity
              </h2>
            </div>
            <AmountInput
              value={depositAmount}
              onChange={setDepositAmount}
              asset={depositAsset}
              label="Deposit amount"
              required
              disabled={isDepositing}
              showPreview={depositPreview !== undefined}
              previewValue={depositPreview}
              previewLabel={
                depositPreview === undefined
                  ? "Share estimate unavailable until the current share price is loaded"
                  : `${depositPreview.toFixed(7)} LP shares at ${sharePrice!.toFixed(7)} USDC per share`
              }
            />
            <Button
              type="submit"
              disabled={isDepositing || !isVerified}
              className="w-full"
            >
              {isDepositing ? "Depositing..." : "Deposit USDC"}
            </Button>
            <SimulationPreview
              details={simDetails}
              error={simError}
              isLoading={isSimulating}
            />
          </form>

          <form
            onSubmit={handleWithdraw}
            className="space-y-4 rounded-lg border border-border bg-card p-5"
          >
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              <h2 className="font-mono text-sm font-bold uppercase text-white">
                Redeem LP Shares
              </h2>
            </div>
            <AmountInput
              value={withdrawShares}
              onChange={setWithdrawShares}
              asset={withdrawAsset}
              label="LP shares to redeem"
              required
              disabled={isWithdrawing}
              showPreview={withdrawalPreview !== undefined}
              previewValue={withdrawalPreview}
              previewLabel={
                withdrawalPreview === undefined
                  ? "Withdrawal estimate unavailable until the current share price is loaded"
                  : `${withdrawalPreview.toFixed(7)} USDC at ${sharePrice!.toFixed(7)} USDC per share`
              }
            />
            <Button
              type="submit"
              disabled={isWithdrawing || !isVerified}
              className="w-full"
            >
              {isWithdrawing ? "Redeeming..." : "Redeem Shares"}
            </Button>
            <SimulationPreview
              details={withdrawSimDetails}
              error={withdrawSimError}
              isLoading={isWithdrawSimulating}
            />
          </form>
        </div>

        <ErrorBoundary context="LPPosition">
          {isPositionLoading ? (
            <LPPositionCardSkeleton />
          ) : (
            position && (
              <div className="rounded-lg border border-border bg-card p-5 font-mono text-xs text-slate-400">
                Current LP position is synchronized from the pool contract.
              </div>
            )
          )}
        </ErrorBoundary>
      </div>

      {showPending && (
        <TransactionPending
          isOpen={showPending}
          txHash={pendingHash}
          statusText={pendingText}
          onClose={pendingHash ? () => setShowPending(false) : undefined}
        />
      )}
    </PageLayout>
  );
}
