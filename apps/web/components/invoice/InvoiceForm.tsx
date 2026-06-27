'use client';

import React, { useState, useEffect } from 'react';
import { useInvoices } from '@/hooks/useInvoices';
import { Button } from '@/components/ui/button';
import { ShieldAlert, PlusCircle } from 'lucide-react';
import type { AssetType } from '@/types';
import { ASSET_OPTIONS } from '@/lib/assets';
import { AmountInput } from '@/components/shared/AmountInput';
import { useWalletStore } from '@/store/wallet';
import { InvoiceClient } from '@trusttrove/sdk';
import { xdr, nativeToScVal, StrKey } from '@stellar/stellar-sdk';
import { SimulationPreview } from '@/components/shared/SimulationPreview';

const invoiceContractID = process.env.NEXT_PUBLIC_INVOICE_CONTRACT_ID || '';


interface InvoiceFormProps {
  onSuccess?: () => void;
}

export function InvoiceForm({ onSuccess }: InvoiceFormProps) {
  const { createInvoice, isCreating, listInvoice } = useInvoices();
  const [buyer, setBuyer] = useState('');
  const [faceValue, setFaceValue] = useState('');
  const [asset, setAsset] = useState<AssetType>('USDC');
  const [dueDays, setDueDays] = useState('60');
  const [discountBps, setDiscountBps] = useState(200); // default 2% (200 bps)
  const [immediateList, setImmediateList] = useState(true);
  
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1); // Step 1: Input, Step 2: Sign Summary
  const [isListing, setIsListing] = useState(false);

  const { address } = useWalletStore();
  const [simDetails, setSimDetails] = useState<any>(null);
  const [simError, setSimError] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const [simulationDiscountBps, setSimulationDiscountBps] = useState(discountBps);

  // Debounce discount changes so simulation only runs after slider settles on step 2
  useEffect(() => {
    if (step !== 2) return;
    const timer = setTimeout(() => setSimulationDiscountBps(discountBps), 500);
    return () => clearTimeout(timer);
  }, [step, discountBps]);

  useEffect(() => {
    if (step !== 2 || !address) return;

    let active = true;
    const runSim = async () => {
      setIsSimulating(true);
      setSimError(null);
      setSimDetails(null);
      setIsFallback(false);

      try {
        const invoiceClient = new InvoiceClient(invoiceContractID);
        let invoiceIdToSimulate = '';

        try {
          const { getInvoices } = await import('@/lib/api');
          const myInvoices = await getInvoices({ issuer: address });
          if (myInvoices && myInvoices.data.length > 0) {
            invoiceIdToSimulate = myInvoices.data[0].id;
          }
        } catch (e) {
          console.warn('Failed to fetch existing invoices for simulation:', e);
        }

        if (!invoiceIdToSimulate) {
          invoiceIdToSimulate = '0000000000000000000000000000000000000000000000000000000000000000';
        }

        const args = [
          xdr.ScVal.scvBytes(Buffer.from(invoiceIdToSimulate, 'hex')),
          nativeToScVal(simulationDiscountBps, { type: 'u32' }),
        ];

        const simResult = await invoiceClient.simulateTransaction('list_for_financing', args, address);
        if (!active) return;
        setSimDetails(simResult);
      } catch (err: any) {
        if (!active) return;
        const errMsg = err.message || '';
        if (
          errMsg.includes('not found') ||
          errMsg.includes('NotFound') ||
          errMsg.includes('Host') ||
          errMsg.includes('Simulation failed') ||
          errMsg.includes('missing')
        ) {
          setIsFallback(true);
          setSimDetails({
            estimatedFeeXlm: '0.0051185',
            functionName: 'list_for_financing',
            expectedResult: null,
            footprintSize: 4,
          });
        } else {
          setSimError(errMsg);
        }
      } finally {
        if (active) setIsSimulating(false);
      }
    };

    const timerId = setTimeout(() => {
      runSim();
    }, 300);

    return () => {
      active = false;
      clearTimeout(timerId);
    };
  }, [step, address, simulationDiscountBps]);

  const parsedValue = parseFloat(faceValue.replace(/,/g, '')) || 0;
  
  // Calculations
  const discountPaid = parsedValue * (discountBps / 10000);
  const payoutAmount = parsedValue - discountPaid;

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedBuyer = buyer.trim();
    if (!trimmedBuyer || !StrKey.isValidEd25519PublicKey(trimmedBuyer)) {
      setError('Buyer must be a valid Stellar public key (G... account address)');
      return;
    }
    if (trimmedBuyer !== buyer) setBuyer(trimmedBuyer);

    if (parsedValue <= 0) {
      setError('Face value must be a positive number');
      return;
    }

    const days = parseInt(dueDays, 10);
    if (isNaN(days) || days <= 0) {
      setError('Due days must be at least 1 day in the future');
      return;
    }

    setStep(2);
  };

  const handleCreate = async () => {
    setError(null);
    try {
      const faceValueStroops = BigInt(Math.floor(parsedValue * 10_000_000)).toString();
      const dueDateTimestamp = Math.floor(Date.now() / 1000) + parseInt(dueDays, 10) * 24 * 60 * 60;

      // Transaction 1: Create
      const res = await createInvoice({
        buyer,
        faceValue: faceValueStroops,
        dueDate: dueDateTimestamp,
        asset,
      });

      const invoiceId = res.invoice_id;

      // Transaction 2: Immediate List
      if (immediateList && invoiceId) {
        setIsListing(true);
        // Pre-simulate list_for_financing on the newly created invoice ID before Freighter opens
        try {
          const invoiceClient = new InvoiceClient(invoiceContractID);
          const args = [
            xdr.ScVal.scvBytes(Buffer.from(invoiceId, 'hex')),
            nativeToScVal(discountBps, { type: 'u32' }),
          ];
          await invoiceClient.simulateTransaction('list_for_financing', args, address!);
        } catch (simErr: any) {
          throw new Error(`Simulation failed: ${simErr.message || 'Validation error'}`);
        }

        await listInvoice({
          invoiceId,
          discountBps,
        });
      }

      // Reset Form
      setBuyer('');
      setFaceValue('');
      setDueDays('60');
      setStep(1);
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Transaction failed');
    } finally {
      setIsListing(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-4 border-b border-border/40 pb-3">
        <PlusCircle className="w-4 h-4 text-primary shrink-0" />
        <h2 className="text-sm font-bold font-mono tracking-wider uppercase text-white">Create trade Invoice</h2>
      </div>

      {/* Step Indicators */}
      <div className="flex items-center gap-2 mb-5 px-1">
        <div className={`flex items-center gap-1.5 ${step === 1 ? 'text-primary' : 'text-emerald-400'}`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold font-mono border ${step === 1 ? 'bg-primary/20 border-primary text-primary' : 'bg-emerald-400/20 border-emerald-400 text-emerald-400'}`}>1</div>
          <span className="text-[10px] font-bold font-mono uppercase tracking-wider">Terms</span>
        </div>
        <div className={`flex-1 h-px mx-1 ${step === 2 ? 'bg-emerald-400/50' : 'bg-border'}`} />
        <div className={`flex items-center gap-1.5 ${step === 2 ? 'text-primary' : 'text-slate-500'}`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold font-mono border ${step === 2 ? 'bg-primary/20 border-primary text-primary' : 'bg-slate-800 border-border text-slate-500'}`}>2</div>
          <span className="text-[10px] font-bold font-mono uppercase tracking-wider">Sign</span>
        </div>
      </div>

      {step === 1 ? (
        <form onSubmit={handleNextStep} className="space-y-4">
          {/* Buyer input */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider">
              Buyer Wallet Address
            </label>
            <input
              type="text"
              placeholder="e.g. GBBD47IF6L... (Stellar Public Key)"
              className="w-full bg-[#080c10] border border-border rounded px-3 py-2.5 text-white text-xs font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all min-h-[44px]"
              value={buyer}
              onChange={(e) => setBuyer(e.target.value)}
              required
            />
          </div>

          {/* Value, Asset, and Days */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-1">
              <AmountInput
                value={faceValue}
                onChange={setFaceValue}
                asset={asset}
                label="Face Value"
                placeholder="50,000.00"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider">
                Asset
              </label>
              <select
                value={asset}
                onChange={(e) => setAsset(e.target.value as AssetType)}
                className="w-full bg-[#080c10] border border-border rounded px-3 py-2.5 text-white text-xs font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all min-h-[44px]"
              >
                {ASSET_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider">
                Due Days
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="60"
                className="w-full bg-[#080c10] border border-border rounded px-3 py-2.5 text-white text-xs font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all min-h-[44px]"
                value={dueDays}
                onChange={(e) => setDueDays(e.target.value.replace(/\D/g, ''))}
                required
              />
              <span className="text-[10px] font-mono text-slate-500 block mt-1">
                Days until payment maturity
              </span>
            </div>
          </div>

          {/* Discount slider */}
          <div className="space-y-2 pt-2 border-t border-border/30">
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-slate-500 font-bold uppercase tracking-wider">Financing Discount Rate</span>
              <span className="text-primary font-bold">{(discountBps / 100).toFixed(2)}% ({discountBps} bps)</span>
            </div>
            <input
              type="range"
              min="50"
              max="500"
              step="10"
              value={discountBps}
              onChange={(e) => setDiscountBps(parseInt(e.target.value))}
              className="w-full accent-primary bg-slate-900 h-2 rounded cursor-pointer touch-pan-y"
            />
            <div className="flex justify-between text-[9px] text-slate-600 font-mono">
              <span>0.5% (50 bps)</span>
              <span>5.0% (500 bps)</span>
            </div>
          </div>

          {/* Immediate Listing option */}
          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="immediateList"
              className="rounded bg-[#080c10] border-border text-primary focus:ring-primary focus:ring-offset-0 w-5 h-5 shrink-0 cursor-pointer"
              checked={immediateList}
              onChange={(e) => setImmediateList(e.target.checked)}
            />
            <label htmlFor="immediateList" className="text-xs font-mono text-slate-400 cursor-pointer select-none py-2">
              List for immediate LP financing at creation
            </label>
          </div>

          {error && (
            <div className="p-3 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="font-mono">{error}</span>
            </div>
          )}

          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary-hover text-black font-bold uppercase tracking-wider text-xs rounded py-2.5 min-h-[44px] shadow-[0_0_15px_rgba(0,212,170,0.1)]"
          >
            REVIEW FINANCING TERMS
          </Button>
        </form>
      ) : (
        // Step 2: Sign summary
        <div className="space-y-4 font-mono text-xs">
          <div className="bg-[#080c10] border border-border p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Invoice Face Value:</span>
              <span className="text-white font-bold">{parsedValue.toLocaleString()} {asset}</span>
            </div>
            
            {immediateList ? (
              <>
                <div className="flex justify-between text-rose-400">
                  <span>Discount ({(discountBps / 100).toFixed(2)}%):</span>
                  <span>-{discountPaid.toLocaleString()} {asset}</span>
                </div>
                <div className="border-t border-border/40 my-2 pt-2 flex justify-between text-emerald-400 font-bold">
                  <span>Net Payout Today:</span>
                  <span>{payoutAmount.toLocaleString()} {asset}</span>
                </div>
                <div className="flex justify-between text-slate-400 text-[10px]">
                  <span>Buyer Repayment (due in {dueDays}d):</span>
                  <span>{parsedValue.toLocaleString()} {asset}</span>
                </div>
              </>
            ) : (
              <div className="text-[10px] text-slate-400 pt-2 border-t border-border/20">
                Created with zero discount list terms. (Can configure financing later).
              </div>
            )}
          </div>

          <div className="bg-[#080c10] border border-amber-500/20 p-3 rounded text-[10px] text-amber-500 leading-normal">
            <span className="font-bold block uppercase mb-1">On-chain privacy note</span>
            Your invoice ID is generated on-chain. No commercial documents are stored on-chain — only invoice terms and addresses.
          </div>

          {immediateList && (
            <SimulationPreview
              details={simDetails}
              error={simError}
              isLoading={isSimulating}
              isFallback={isFallback}
            />
          )}

          {error && (
            <div className="p-3 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              className="flex-1 border border-border bg-transparent hover:bg-slate-900 text-slate-400 font-bold uppercase py-2 min-h-[44px]"
              onClick={() => setStep(1)}
              disabled={isCreating || isListing}
            >
              EDIT
            </Button>
            <Button
              className="flex-1 bg-primary hover:bg-primary-hover text-black font-bold uppercase py-2 min-h-[44px] flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(0,212,170,0.15)]"
              onClick={handleCreate}
              disabled={isCreating || isListing}
            >
              {isCreating || isListing ? 'SIGNING...' : 'SIGN & LIST'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
