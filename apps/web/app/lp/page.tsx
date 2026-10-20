"use client";

import React, { useEffect, useRef, useState } from "react";
import { PageLayout } from "@/components/shared/PageLayout";
import { WalletConnect } from "@/components/shared/WalletConnect";
import { SimulationPreview } from "@/components/shared/SimulationPreview";
import {
  LPPositionCardSkeleton,
  PoolStatsPanelSkeleton,
} from "@/components/shared/SkeletonLoader";
import { usePool } from "@/hooks/usePool";
import { useWalletStore } from "@/store/wallet";
import { useConfirmDialogStore } from "@/store/confirmDialog";
import { PoolClient, type SimulationResult } from "@trusttrove/sdk";
import { Address, nativeToScVal } from "@stellar/stellar-sdk";
import { formatAmount } from "@/lib/assets";

const poolContractID = process.env.NEXT_PUBLIC_POOL_CONTRACT_ID || "";
const STROOPS_PER_UNIT = 10_000_000;

function formatShareValue(value: bigint | undefined): string {
  return formatAmount(value ?? 0n);
}

export default function LPDashboard() {
  const connected = useWalletStore((s) => s.connected);
  const address = useWalletStore((s) => s.address);
  const {
    deposit,
    withdraw,
    isDepositing,
    isWithdrawing,
    stats,
    isStatsLoading,
    position,
    isPositionLoading,
  } = usePool();
  const requestConfirmation = useConfirmDialogStore((state) => state.request);
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawShares, setWithdrawShares] = useState("");
  const [simDetails, setSimDetails] = useState<SimulationResult | null>(null);
  const [simError, setSimError] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const depositInputRef = useRef<HTMLInputElement>(null);
  const withdrawInputRef = useRef<HTMLInputElement>(null);

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
        const amountStroops = BigInt(Math.floor(amount * STROOPS_PER_UNIT));
        const client = new PoolClient(poolContractID);
        const result = await client.simulateTransaction(
          "deposit",
          [
            new Address(address).toScVal(),
            nativeToScVal(amountStroops, { type: "u128" }),
          ],
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

  if (!connected) {
    return (
      <PageLayout>
        <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6">
          <h1 className="text-2xl font-bold text-white">Connect Your Wallet</h1>
          <WalletConnect />
        </div>
      </PageLayout>
    );
  }

  const handleDeposit = async (event: React.FormEvent) => {
    event.preventDefault();
    const amount = Number(depositAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setDepositError("Enter an amount greater than zero.");
      depositInputRef.current?.focus();
      return;
    }
    setDepositError(null);

    await deposit({
      amount: BigInt(Math.floor(amount * STROOPS_PER_UNIT)),
      asset: "USDC",
    });
    setDepositAmount("");
  };

  const handleWithdraw = (event: React.FormEvent) => {
    event.preventDefault();
    const shares = Number(withdrawShares);
    const shareAmount = Number.isFinite(shares)
      ? BigInt(Math.floor(shares * STROOPS_PER_UNIT))
      : 0n;
    if (!Number.isFinite(shares) || shares <= 0) {
      setWithdrawError("Enter an amount greater than zero.");
      withdrawInputRef.current?.focus();
      return;
    }
    if (shareAmount > (position?.shares ?? 0n)) {
      setWithdrawError("Amount exceeds your redeemable shares.");
      withdrawInputRef.current?.focus();
      return;
    }
    setWithdrawError(null);

    requestConfirmation({
      label: "Withdraw LP liquidity",
      invoiceId: address || "LP position",
      fn: async () => {
        await withdraw({ shares: shareAmount });
        setWithdrawShares("");
      },
    });
  };

  const utilization = Math.min(
    100,
    Math.max(0, (stats?.utilizationRateBps ?? 0) / 100),
  );

  return (
    <PageLayout>
      <div className="mx-auto max-w-5xl space-y-6 py-4">
        <div>
          <h1 className="text-xl font-bold uppercase text-white">
            Liquidity Provider Portal
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Supply USDC liquidity, track pool performance, and manage your
            position.
          </p>
        </div>

        <section aria-labelledby="pool-overview-heading" className="space-y-3">
          <h2
            id="pool-overview-heading"
            className="text-sm font-bold uppercase tracking-wider text-white"
          >
            Pool Overview
          </h2>
          {isStatsLoading ? (
            <PoolStatsPanelSkeleton />
          ) : (
            <div className="bg-card border border-border rounded-lg p-6 flex flex-col md:flex-row items-center gap-8">
              <div
                className="relative flex h-36 w-36 shrink-0 items-center justify-center rounded-full border-[8px] border-slate-900"
                style={{
                  background: `conic-gradient(#00d4aa ${utilization}%, #17212b ${utilization}% 100%)`,
                }}
              >
                <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-card">
                  <span className="text-2xl font-bold text-white">
                    {utilization.toFixed(1)}%
                  </span>
                  <span className="text-[10px] uppercase text-slate-500">
                    Utilization
                  </span>
                </div>
              </div>
              <div className="grid w-full grid-cols-2 gap-6">
                <Stat
                  label="Total Deposits"
                  value={formatShareValue(stats?.totalDeposits)}
                />
                <Stat
                  label="Available Liquidity"
                  value={formatShareValue(stats?.availableLiquidity)}
                />
                <Stat
                  label="Yield Distributed"
                  value={formatShareValue(stats?.totalYieldDistributed)}
                />
                <Stat
                  label="Active Invoices"
                  value={String(stats?.activeInvoiceCount ?? 0)}
                />
              </div>
            </div>
          )}
        </section>

        <section aria-labelledby="position-heading" className="space-y-3">
          <h2
            id="position-heading"
            className="text-sm font-bold uppercase tracking-wider text-white"
          >
            My Position
          </h2>
          {isPositionLoading ? (
            <LPPositionCardSkeleton />
          ) : (
            <div className="bg-[#0d131a] border border-border rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  Active LP Position
                </span>
                <span className="text-[10px] text-slate-500">
                  {position?.depositCount ?? 0} deposits
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Stat
                  label="Current USDC Value"
                  value={formatShareValue(position?.usdcValue)}
                />
                <Stat
                  label="Redeemable Shares"
                  value={formatShareValue(position?.shares)}
                />
                <Stat
                  label="Accrued Yield"
                  value={formatShareValue(position?.yieldEarned)}
                />
              </div>
            </div>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <form
            onSubmit={handleDeposit}
            className="space-y-4 rounded-lg border border-border bg-card p-6"
          >
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Deposit USDC
            </h2>
            <label
              htmlFor="deposit-amount"
              className="block text-sm text-slate-300"
            >
              Deposit amount
            </label>
            <input
              ref={depositInputRef}
              id="deposit-amount"
              type="number"
              step="any"
              value={depositAmount}
              aria-invalid={depositError ? "true" : undefined}
              aria-describedby={depositError ? "deposit-amount-error" : undefined}
              onChange={(event) => {
                setDepositAmount(event.target.value);
                setDepositError(null);
              }}
              className="w-full rounded border border-border bg-slate-950 px-3 py-2 text-white"
            />
            {depositError && (
              <p id="deposit-amount-error" role="alert" className="text-sm text-rose-300">
                {depositError}
              </p>
            )}
            <SimulationPreview
              details={simDetails}
              error={simError}
              isLoading={isSimulating}
            />
            <button
              type="submit"
              disabled={isDepositing}
              className="rounded bg-primary px-4 py-2 font-semibold text-black disabled:opacity-50"
            >
              {isDepositing ? "Depositing..." : "Deposit USDC"}
            </button>
          </form>

          <form
            onSubmit={handleWithdraw}
            className="space-y-4 rounded-lg border border-border bg-card p-6"
          >
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Withdraw Liquidity
            </h2>
            <label
              htmlFor="withdraw-shares"
              className="block text-sm text-slate-300"
            >
              Shares to redeem
            </label>
            <input
              ref={withdrawInputRef}
              id="withdraw-shares"
              type="number"
              step="any"
              value={withdrawShares}
              aria-invalid={withdrawError ? "true" : undefined}
              aria-describedby={`withdraw-available${withdrawError ? " withdraw-shares-error" : ""}`}
              onChange={(event) => {
                setWithdrawShares(event.target.value);
                setWithdrawError(null);
              }}
              className="w-full rounded border border-border bg-slate-950 px-3 py-2 text-white"
            />
            {withdrawError && (
              <p id="withdraw-shares-error" role="alert" className="text-sm text-rose-300">
                {withdrawError}
              </p>
            )}
            <p id="withdraw-available" className="text-xs text-slate-500">
              Available: {formatShareValue(position?.shares)}
            </p>
            <button
              type="submit"
              disabled={isWithdrawing || !position?.shares}
              className="rounded border border-rose-500/60 px-4 py-2 font-semibold text-rose-300 disabled:opacity-50"
            >
              {isWithdrawing ? "Withdrawing..." : "Withdraw Shares"}
            </button>
          </form>
        </div>
      </div>
    </PageLayout>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <span className="block text-sm font-semibold text-white">{value}</span>
    </div>
  );
}
