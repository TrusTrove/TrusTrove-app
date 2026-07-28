"use client";

import React, { useEffect, useState } from "react";
import { PageLayout } from "@/components/shared/PageLayout";
import { WalletConnect } from "@/components/shared/WalletConnect";
import { SimulationPreview } from "@/components/shared/SimulationPreview";
import { usePool } from "@/hooks/usePool";
import { useWalletStore } from "@/store/wallet";
import { PoolClient, type SimulationResult } from "@trusttrove/sdk";
import { Address, nativeToScVal } from "@stellar/stellar-sdk";

const poolContractID = process.env.NEXT_PUBLIC_POOL_CONTRACT_ID || "";

export default function LPDashboard() {
  const { connected, address } = useWalletStore();
  const { deposit, isDepositing } = usePool();
  const [depositAmount, setDepositAmount] = useState("");
  const [simDetails, setSimDetails] = useState<SimulationResult | null>(null);
  const [simError, setSimError] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

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
      setSimDetails(null);

      try {
        const amountStroops = BigInt(Math.floor(amount * 10_000_000));
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
    if (!Number.isFinite(amount) || amount <= 0) return;

    await deposit({ amount: BigInt(Math.floor(amount * 10_000_000)) });
    setDepositAmount("");
  };

  return (
    <PageLayout>
      <div className="mx-auto max-w-2xl space-y-6 py-4">
        <div>
          <h1 className="text-xl font-bold uppercase text-white">
            Liquidity Provider Portal
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Supply USDC liquidity and earn yield.
          </p>
        </div>

        <form onSubmit={handleDeposit} className="space-y-4 rounded-lg border border-border bg-card p-6">
          <label htmlFor="deposit-amount" className="block text-sm text-slate-300">
            Deposit amount
          </label>
          <input
            id="deposit-amount"
            type="number"
            min="0"
            step="any"
            value={depositAmount}
            onChange={(event) => setDepositAmount(event.target.value)}
            className="w-full rounded border border-border bg-slate-950 px-3 py-2 text-white"
          />
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
      </div>
    </PageLayout>
  );
}
