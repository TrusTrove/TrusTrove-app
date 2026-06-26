'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { PageLayout } from '@/components/shared/PageLayout';
import { usePool } from '@/hooks/usePool';
import { useWalletStore } from '@/store/wallet';
import { useProfile } from '@/hooks/useProfile';
import { WalletConnect } from '@/components/shared/WalletConnect';
import { PoolStatsPanelSkeleton, LPPositionCardSkeleton } from '@/components/shared/SkeletonLoader';
import { Button } from '@/components/ui/button';
import { TransactionPending } from '@/components/shared/TransactionPending';
import { AmountInput } from '@/components/shared/AmountInput';
import { Coins, Unlock, Landmark, Wallet, ShieldAlert, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import type { AssetType } from '@/types';
import { ASSET_OPTIONS, formatAmount } from '@/lib/assets';
import { PoolClient } from '@trusttrove/sdk';
import { Address, nativeToScVal } from '@stellar/stellar-sdk';
import { SimulationPreview } from '@/components/shared/SimulationPreview';
import { useQuery } from '@tanstack/react-query';
import { getPoolSnapshots } from '@/lib/api';

const poolContractID = process.env.NEXT_PUBLIC_POOL_CONTRACT_ID || '';


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
    depositError,
    withdraw,
    isWithdrawing,
    withdrawError,
  } = usePool();

  const [depositAmount, setDepositAmount] = useState('');
  const [depositAsset, setDepositAsset] = useState<AssetType>('USDC');
  const [withdrawShares, setWithdrawShares] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  
  // Pending Modal states
  const [showPending, setShowPending] = useState(false);
  const [pendingHash, setPendingHash] = useState<string | null>(null);
  const [pendingText, setPendingText] = useState('Waiting for confirmation...');

  // Simulation states
  const [simDetails, setSimDetails] = useState<any>(null);
  const [simError, setSimError] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    const amountNum = Number(depositAmount);
    if (!address || isNaN(amountNum) || amountNum <= 0) {
      setSimDetails(null);
      setSimError(null);
      return;
    }

    let active = true;
    const runSim = async () => {
      setIsSimulating(true);
      setSimError(null);
      setSimDetails(null);

      try {
        const poolClient = new PoolClient(poolContractID);
        const amountStroops = BigInt(Math.floor(amountNum * 10_000_000));
        const args = [
          new Address(address).toScVal(),
          nativeToScVal(amountStroops, { type: 'u128' }),
        ];

        const simResult = await poolClient.simulateTransaction('deposit', args, address);
        if (!active) return;
        setSimDetails(simResult);
      } catch (err: any) {
        if (!active) return;
        setSimError(err.message || 'Simulation failed');
      } finally {
        if (active) setIsSimulating(false);
      }
    };

    const timer = setTimeout(runSim, 400);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [depositAmount, address]);

  const { data: snapshots, isLoading: isSnapshotsLoading } = useQuery({
    queryKey: ['poolSnapshots'],
    queryFn: getPoolSnapshots,
  });

  const chartLines = useMemo(() => {
    if (!snapshots || snapshots.length < 2) return null;

    const sorted = [...snapshots].sort((a, b) => a.timestamp - b.timestamp);
    const values = sorted.map((s) => s.utilizationRateBps);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const pad = 10;
    const chartW = 500;
    const chartH = 150;
    const chartTop = pad;
    const chartBottom = chartH - pad;
    const chartHeight = chartBottom - chartTop;

    const points = sorted.map((s, i) => {
      const x = i / (sorted.length - 1) * chartW;
      const y = chartBottom - ((s.utilizationRateBps - min) / range) * chartHeight;
      return { x, y };
    });

    const lineD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaD = `${lineD} L ${points[points.length - 1].x} ${chartBottom} L ${points[0].x} ${chartBottom} Z`;

    const rawLabels = sorted.map((s) => s.timestamp);
    const displayIndices = sorted.length <= 5
      ? rawLabels.map((_, i) => i)
      : [0, Math.floor((sorted.length - 1) / 4), Math.floor((sorted.length - 1) / 2), Math.floor(3 * (sorted.length - 1) / 4), sorted.length - 1];

    const labels = displayIndices.map((i) => {
      const snap = sorted[i];
      const date = new Date(snap.timestamp * 1000);
      const month = date.toLocaleString('default', { month: 'short' });
      const day = date.getDate();
      return `${month} ${day}`;
    });

    return { lineD, areaD, labels, points };
  }, [snapshots]);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const amountNum = Number(depositAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setLocalError('Please enter a valid deposit amount');
      return;
    }
    
    try {
      const amountStroops = BigInt(Math.floor(amountNum * 10_000_000));
      
      // Pre-simulate deposit before Freighter opens
      const poolClient = new PoolClient(poolContractID);
      const args = [
        new Address(address!).toScVal(),
        nativeToScVal(amountStroops, { type: 'u128' }),
      ];
      await poolClient.simulateTransaction('deposit', args, address!);

      setPendingText(`Depositing ${depositAsset} into pool...`);
      setPendingHash(null);
      setShowPending(true);

      // TODO(#19): Pass depositAsset to contract when XLM support is merged
      // Currently PoolClient.deposit() only accepts USDC amount
      const res = await deposit({ amount: amountStroops });
      if (typeof res === 'string') {
        setPendingHash(res);
      }
      setDepositAmount('');
    } catch (err: any) {
      setLocalError(err.message || 'Deposit failed');
      setShowPending(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const sharesNum = Number(withdrawShares);
    if (isNaN(sharesNum) || sharesNum <= 0) {
      setLocalError('Please enter a valid shares amount to withdraw');
      return;
    }

    setPendingText('Redeeming LP shares...');
    setPendingHash(null);
    setShowPending(true);

    try {
      const sharesStroops = BigInt(Math.floor(sharesNum * 10_000_000));
      const txHash = await withdraw({ shares: sharesStroops });
      setPendingHash(txHash);
      setWithdrawShares('');
    } catch (err: any) {
      setLocalError(err.message || 'Withdrawal failed');
      setShowPending(false);
    }
  };

  // Compute utilization colors
  const utilizationRate = stats ? Number(stats.utilizationRateBps) / 100 : 0;
  
  const getGaugeColor = (rate: number) => {
    if (rate < 50) return '#00d4aa'; // Teal
    if (rate < 80) return '#3b82f6'; // Blue
    if (rate < 95) return '#f59e0b'; // Amber
    return '#ef4444'; // Red
  };

  const gaugeColor = getGaugeColor(utilizationRate);

  if (!connected) {
    return (
      <PageLayout>
        <div className="flex flex-col items-center justify-center text-center py-20 max-w-md mx-auto min-h-[70vh]">
          <div className="bg-primary/10 border border-primary/20 p-4 rounded-lg mb-6 shadow-[0_0_20px_rgba(0,212,170,0.15)]">
            <Landmark className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-2xl font-bold font-mono tracking-wider text-white uppercase mb-2">Connect Your Wallet</h1>
          <p className="text-slate-400 text-xs font-mono mb-8 leading-relaxed">
            Connect your Freighter wallet to access the Liquidity Pool Portal, supply USDC, and earn yield.
          </p>
          <WalletConnect />
        </div>
      </PageLayout>
    );
  }

  // Previews
  const parsedDep = parseFloat(depositAmount) || 0;
  const depSharesPreview = parsedDep * 1.0; // Assumes 1:1 share price
  
  const parsedWith = parseFloat(withdrawShares) || 0;
  const withUsdcPreview = parsedWith * 1.0;

  return (
    <PageLayout>
      <div className="space-y-8 py-4">
        {/* Header */}
        <div className="border-b border-border/40 pb-5">
          <h1 className="text-xl font-bold font-mono tracking-wider uppercase text-white">Liquidity Provider Portal</h1>
          <p className="text-slate-500 text-xs font-mono mt-1">
            Supply USDC liquidity to automate invoice discounting and capture trade yield.
          </p>
        </div>

        {/* Warning Banner for Unverified Profiles */}
        {!isVerified && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-start gap-3 font-mono text-xs text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.02)]">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold uppercase">Profile Verification Required</span>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                Your connected wallet address is not verified on-chain. To supply liquidity, redeem LP shares, or capture yield, you must register your business credentials. Go to the <Link href="/profile" className="text-primary hover:underline font-bold">[Profile Page]</Link> to register.
              </p>
            </div>
          </div>
        )}

        {/* 2-Panel Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT PANEL: Pool Overview */}
          <div className="lg:col-span-7 space-y-6">
            {isStatsLoading ? (
              <PoolStatsPanelSkeleton />
            ) : (
            <div className="bg-card border border-border rounded-lg p-6 flex flex-col md:flex-row items-center gap-8 shadow-[0_0_20px_rgba(0,212,170,0.01)]">
              {/* Circular Gauge */}
              <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90">
                  <circle
                    cx="72"
                    cy="72"
                    r="58"
                    className="stroke-[#080c10] fill-transparent"
                    strokeWidth="8"
                  />
                  <motion.circle
                    cx="72"
                    cy="72"
                    r="58"
                    className="fill-transparent"
                    stroke={gaugeColor}
                    strokeWidth="8"
                    strokeDasharray={2 * Math.PI * 58}
                    initial={{ strokeDashoffset: 2 * Math.PI * 58 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 58 * (1 - utilizationRate / 100) }}
                    transition={{ duration: 1.2, ease: 'easeOut' }}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center font-mono">
                  <span className="text-2xl font-extrabold text-white">
                    {`${utilizationRate.toFixed(1)}%`}
                  </span>
                  <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">
                    UTILIZATION
                  </span>
                </div>
              </div>

              {/* Pool Details */}
              <div className="grid grid-cols-2 gap-6 w-full font-mono text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Total Deposits</span>
                  <span className="text-md font-bold text-white block mt-1">
                    {formatAmount(stats?.totalDeposits)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Available Liquidity</span>
                  <span className="text-md font-bold text-primary block mt-1">
                    {formatAmount(stats?.availableLiquidity)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Yield Distributed</span>
                  <span className="text-md font-bold text-emerald-400 block mt-1">
                    {formatAmount(stats?.totalYieldDistributed)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Active Invoices</span>
                  <span className="text-md font-bold text-slate-300 block mt-1">
                    {`${stats?.activeInvoiceCount || 0} active`}
                  </span>
                </div>
              </div>
            </div>
            )}

            {/* Historical Yield Line Chart (SVG based) */}
            <div className="bg-card border border-border rounded-lg p-5 space-y-4">
              <h3 className="text-xs font-bold font-mono text-white uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-primary" />
                Yield Performance Ledger
              </h3>
              
              <div className="h-44 w-full relative">
                {isSnapshotsLoading && (
                  <div className="flex items-center justify-center h-full text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                    Loading snapshots...
                  </div>
                )}

                {!isSnapshotsLoading && (!chartLines || !snapshots || snapshots.length < 2) && (
                  <div className="flex items-center justify-center h-full text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                    Insufficient historical data
                  </div>
                )}

                {chartLines && (
                  <>
                    <svg className="w-full h-full" viewBox="0 0 500 150">
                      <defs>
                        <linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#00d4aa" stopOpacity="0.15" />
                          <stop offset="100%" stopColor="#00d4aa" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {/* Grid Lines */}
                      <line x1="0" y1="30" x2="500" y2="30" stroke="#1a2330" strokeWidth="0.5" strokeDasharray="3 3" />
                      <line x1="0" y1="75" x2="500" y2="75" stroke="#1a2330" strokeWidth="0.5" strokeDasharray="3 3" />
                      <line x1="0" y1="120" x2="500" y2="120" stroke="#1a2330" strokeWidth="0.5" strokeDasharray="3 3" />
                      
                      {/* Area fill */}
                      <path
                        d={chartLines.areaD}
                        fill="url(#chartGlow)"
                      />
                      
                      {/* Line path */}
                      <motion.path
                        d={chartLines.lineD}
                        fill="transparent"
                        stroke="#00d4aa"
                        strokeWidth="2"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.5, ease: 'easeInOut' }}
                      />
                    </svg>

                    {/* X Axis Labels */}
                    <div className="flex justify-between mt-1 text-[9px] font-mono text-slate-500 uppercase tracking-widest px-2">
                      {chartLines.labels.map((label, i) => (
                        <span key={i}>{label}</span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: My Position */}
          <div className="lg:col-span-5 space-y-6">
            {isPositionLoading ? (
              <LPPositionCardSkeleton />
            ) : (
            <div className="bg-[#0d131a] border border-border rounded-lg p-5 space-y-4">
              <h3 className="text-xs font-bold font-mono text-white uppercase tracking-wider border-b border-border/40 pb-2 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-primary" />
                Active LP Position
              </h3>

              <div className="space-y-4 font-mono text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Current USDC Value</span>
                  <span className="text-xl font-bold text-white block mt-1">
                    {formatAmount(position?.usdcValue)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-border/30 pt-3">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Redeemable Shares</span>
                    <span className="text-sm font-bold text-slate-300 block mt-0.5">
                      {(Number(position?.shares || 0n) / 10_000_000).toLocaleString(undefined, { minimumFractionDigits: 4 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Yield Earned</span>
                    <span className="text-sm font-bold text-emerald-400 block mt-0.5">
                      {formatAmount(position?.yieldEarned)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* Deposit & Withdraw forms */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-6">
              {/* Deposit Form */}
              <div className="bg-[#0d131a] border border-border rounded-lg p-5 space-y-4">
                <h4 className="text-xs font-bold font-mono text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-emerald-400" />
                  Deposit {depositAsset}
                </h4>
                <form onSubmit={handleDeposit} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold font-mono text-slate-500 uppercase mb-1">
                      Supply Amount
                    </label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <AmountInput
                          value={depositAmount}
                          onChange={setDepositAmount}
                          asset={depositAsset}
                          placeholder="10,000"
                          disabled={isDepositing}
                          required
                        />
                      </div>
                      <div className="w-24">
                        <select
                          value={depositAsset}
                          onChange={(e) => setDepositAsset(e.target.value as AssetType)}
                          className="w-full bg-[#080c10] border border-border rounded px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-primary h-[38px]"
                        >
                          {ASSET_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {parsedDep > 0 && (
                      <div className="space-y-3 mt-1.5">
                        <span className="text-[10px] font-mono text-slate-400 block leading-tight">
                          Depositing {parsedDep.toLocaleString()} {depositAsset} → receive ~{depSharesPreview.toLocaleString()} LP Shares
                        </span>
                        <SimulationPreview
                          details={simDetails}
                          error={simError}
                          isLoading={isSimulating}
                        />
                      </div>
                    )}
                  </div>
                  <Button
                    type="submit"
                    disabled={isDepositing || !isVerified}
                    className={`w-full font-bold uppercase text-xs tracking-wider rounded py-2 transition-all ${
                      isVerified
                        ? 'bg-primary hover:bg-primary-hover text-black shadow-[0_0_15px_rgba(0,212,170,0.1)]'
                        : 'bg-neutral-800 text-slate-500 border border-neutral-700 cursor-not-allowed opacity-60'
                    }`}
                  >
                    {isDepositing ? 'DEPOSITING...' : `DEPOSIT ${depositAsset}`}
                  </Button>
                </form>
              </div>

              {/* Withdraw Form */}
              <div className="bg-[#0d131a] border border-border rounded-lg p-5 space-y-4">
                <h4 className="text-xs font-bold font-mono text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Unlock className="w-4 h-4 text-indigo-400" />
                  Redeem Shares
                </h4>
                <form onSubmit={handleWithdraw} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold font-mono text-slate-500 uppercase mb-1">
                      Redeem Shares Count
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      placeholder="10,000"
                      className="w-full bg-[#080c10] border border-border rounded px-3 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-primary"
                      value={withdrawShares}
                      onChange={(e) => setWithdrawShares(e.target.value)}
                      disabled={isWithdrawing}
                      required
                    />
                    {parsedWith > 0 && (
                      <span className="text-[10px] font-mono text-slate-400 block mt-1.5 leading-tight">
                        Redeeming {parsedWith.toLocaleString()} Shares → receive ~{withUsdcPreview.toLocaleString()} USDC
                      </span>
                    )}
                  </div>
                  <Button
                    type="submit"
                    disabled={isWithdrawing || !isVerified}
                    className={`w-full font-bold uppercase text-xs tracking-wider rounded py-2 transition-all ${
                      isVerified
                        ? 'bg-slate-900 border border-border hover:bg-slate-800 text-slate-300'
                        : 'bg-neutral-800 text-slate-500 border border-neutral-700 cursor-not-allowed opacity-60'
                    }`}
                  >
                    {isWithdrawing ? 'REDEEMING...' : 'REDEEM SHARES'}
                  </Button>
                </form>
              </div>
            </div>

            {/* Error alerts */}
            {(localError || depositError || withdrawError) && (
              <div className="p-3 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2 font-mono">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  {localError || depositError?.message || withdrawError?.message}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Transaction Pending Modal */}
      <TransactionPending
        isOpen={showPending}
        txHash={pendingHash}
        statusText={pendingText}
        onClose={pendingHash ? () => setShowPending(false) : undefined}
      />
    </PageLayout>
  );
}
