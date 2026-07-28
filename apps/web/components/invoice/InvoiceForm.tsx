"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useInvoices } from "@/hooks/useInvoices";
import { Button } from "@/components/ui/button";
import { ShieldAlert, PlusCircle } from "lucide-react";
import type { AssetType } from "@/types";
import { ASSET_OPTIONS } from "@/lib/assets";
import { AmountInput } from "@/components/shared/AmountInput";
import { useWalletStore } from "@/store/wallet";
import { SimulationPreview } from "@/components/shared/SimulationPreview";

const invoiceContractID = process.env.NEXT_PUBLIC_INVOICE_CONTRACT_ID || "";
const getStellarSdk = () => import("@stellar/stellar-sdk");
const getTrustroveSdk = () => import("@trusttrove/sdk");
const SIMULATION_PLACEHOLDER_INVOICE_ID =
  "0000000000000000000000000000000000000000000000000000000000000000";

interface InvoiceFormProps {
  onSuccess?: () => void;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

async function cancelCreatedInvoice(invoiceId: string) {
  const response = await fetch(
    `/api/invoices/${encodeURIComponent(invoiceId)}/cancel`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Immediate listing transaction failed" }),
    },
  );

  if (!response.ok) {
    throw new Error("Unable to cancel the created invoice");
  }
}

export function InvoiceForm({ onSuccess }: InvoiceFormProps) {
  const { createInvoice, isCreating, listInvoice } = useInvoices();
  const { address } = useWalletStore();
  const [buyer, setBuyer] = useState("");
  const [faceValue, setFaceValue] = useState("");
  const [asset, setAsset] = useState<AssetType>("USDC");
  const [dueDate, setDueDate] = useState("");
  const [discountBps, setDiscountBps] = useState(200);
  const [immediateList, setImmediateList] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [isListing, setIsListing] = useState(false);
  const [simDetails, setSimDetails] = useState<any>(null);
  const [simError, setSimError] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const [simulationDiscountBps, setSimulationDiscountBps] =
    useState(discountBps);

  useEffect(() => {
    if (step !== 2) return;
    const timer = setTimeout(() => setSimulationDiscountBps(discountBps), 500);
    return () => clearTimeout(timer);
  }, [step, discountBps]);

  useEffect(() => {
    if (step !== 2 || !address) return;
    let active = true;

    const runSimulation = async () => {
      setIsSimulating(true);
      setSimError(null);
      setSimDetails(null);
      setIsFallback(false);

      try {
        const [{ InvoiceClient }, { xdr, nativeToScVal }] = await Promise.all([
          getTrustroveSdk(),
          getStellarSdk(),
        ]);
        const client = new InvoiceClient(invoiceContractID);
        const result = await client.simulateTransaction(
          "list_for_financing",
          [
            xdr.ScVal.scvBytes(
              Buffer.from(SIMULATION_PLACEHOLDER_INVOICE_ID, "hex"),
            ),
            nativeToScVal(simulationDiscountBps, { type: "u32" }),
          ],
          address,
        );
        if (active) setSimDetails(result);
      } catch (err: unknown) {
        if (!active) return;
        const message = getErrorMessage(err, "");
        if (
          message.includes("not found") ||
          message.includes("NotFound") ||
          message.includes("Host") ||
          message.includes("Simulation failed") ||
          message.includes("missing")
        ) {
          setIsFallback(true);
        } else {
          setSimError(message);
        }
      } finally {
        if (active) setIsSimulating(false);
      }
    };

    const timer = setTimeout(() => void runSimulation(), 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [step, address, simulationDiscountBps]);

  const parsedValue = useMemo(
    () => parseFloat(faceValue.replace(/,/g, "")) || 0,
    [faceValue],
  );
  const discountPaid = useMemo(
    () => parsedValue * (discountBps / 10000),
    [parsedValue, discountBps],
  );
  const payoutAmount = useMemo(
    () => parsedValue - discountPaid,
    [parsedValue, discountPaid],
  );

  const handleNextStep = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const trimmedBuyer = buyer.trim();
    const { StrKey } = await getStellarSdk();
    if (!trimmedBuyer || !StrKey.isValidEd25519PublicKey(trimmedBuyer)) {
      setError(
        "Buyer must be a valid Stellar public key (G... account address)",
      );
      return;
    }
    if (parsedValue <= 0) {
      setError("Face value must be a positive number");
      return;
    }
    if (!dueDate) {
      setError("Please select a due date");
      return;
    }
    const selectedDate = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate.getTime() <= today.getTime()) {
      setError("Due date must be in the future");
      return;
    }
    if (trimmedBuyer !== buyer) setBuyer(trimmedBuyer);
    setStep(2);
  };

  const handleCreate = async () => {
    setError(null);
    let createdInvoiceId: string | null = null;

    try {
      const response = await createInvoice({
        buyer,
        faceValue: BigInt(Math.floor(parsedValue * 10_000_000)).toString(),
        dueDate: Math.floor(new Date(dueDate).getTime() / 1000),
        asset,
      });

      if (!response.invoice_id || !response.transaction_hash) {
        throw new Error("Invoice creation did not return valid transaction data");
      }
      createdInvoiceId = response.invoice_id;

      if (immediateList) {
        setIsListing(true);
        try {
          const [{ InvoiceClient }, { xdr, nativeToScVal }] = await Promise.all([
            getTrustroveSdk(),
            getStellarSdk(),
          ]);
          const client = new InvoiceClient(invoiceContractID);
          await client.simulateTransaction(
            "list_for_financing",
            [
              xdr.ScVal.scvBytes(Buffer.from(createdInvoiceId, "hex")),
              nativeToScVal(discountBps, { type: "u32" }),
            ],
            address!,
          );
          await listInvoice({ invoiceId: createdInvoiceId, discountBps });
        } catch (listingError: unknown) {
          const listingMessage = getErrorMessage(
            listingError,
            "Immediate listing failed",
          );
          try {
            await cancelCreatedInvoice(createdInvoiceId);
          } catch {
            throw new Error(
              `${listingMessage}. We could not cancel the created invoice automatically. Please contact support with invoice ID ${createdInvoiceId}.`,
            );
          }

          setBuyer("");
          setFaceValue("");
          setDueDate("");
          setStep(1);
          onSuccess?.();
          throw new Error(
            `${listingMessage}. The created invoice was cancelled and is not available for financing.`,
          );
        }
      }

      setBuyer("");
      setFaceValue("");
      setDueDate("");
      setStep(1);
      onSuccess?.();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Transaction failed"));
    } finally {
      setIsListing(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-4 border-b border-border/40 pb-3">
        <PlusCircle className="w-4 h-4 text-primary shrink-0" />
        <h2 className="text-sm font-bold font-mono tracking-wider uppercase text-white">
          Create trade Invoice
        </h2>
      </div>

      <div className="flex items-center gap-2 mb-5 px-1">
        <span className={step === 1 ? "text-primary" : "text-emerald-400"}>
          1. Terms
        </span>
        <span className="flex-1 h-px bg-border" />
        <span className={step === 2 ? "text-primary" : "text-slate-500"}>
          2. Sign
        </span>
      </div>

      {step === 1 ? (
        <form onSubmit={handleNextStep} className="space-y-4">
          <label className="block text-xs font-mono text-slate-400">
            Buyer Wallet Address
            <input
              type="text"
              placeholder="e.g. GBBD47IF6L... (Stellar Public Key)"
              className="mt-1 w-full bg-[#080c10] border border-border rounded px-3 py-2.5 text-white"
              value={buyer}
              onChange={(event) => setBuyer(event.target.value)}
              required
            />
          </label>
          <AmountInput
            value={faceValue}
            onChange={setFaceValue}
            asset={asset}
            label="Face Value"
            placeholder="50,000.00"
            required
          />
          <select
            value={asset}
            onChange={(event) => setAsset(event.target.value as AssetType)}
            className="w-full bg-[#080c10] border border-border rounded px-3 py-2.5 text-white"
          >
            {ASSET_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            min={new Date(Date.now() + 86400000).toISOString().split("T")[0]}
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className="w-full bg-[#080c10] border border-border rounded px-3 py-2.5 text-white"
            required
          />
          <input
            type="range"
            min="50"
            max="500"
            step="10"
            value={discountBps}
            onChange={(event) =>
              setDiscountBps(parseInt(event.target.value, 10))
            }
            aria-label="Financing Discount Rate"
            className="w-full"
          />
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={immediateList}
              onChange={(event) => setImmediateList(event.target.checked)}
            />
            List for immediate LP financing at creation
          </label>
          {error && (
            <div className="p-3 text-rose-400 text-xs flex gap-2">
              <ShieldAlert className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}
          <Button type="submit" className="w-full">
            REVIEW FINANCING TERMS
          </Button>
        </form>
      ) : (
        <div className="space-y-4 font-mono text-xs">
          <div className="border border-border p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span>Invoice Face Value:</span>
              <span>
                {parsedValue.toLocaleString()} {asset}
              </span>
            </div>
            {immediateList ? (
              <>
                <div className="flex justify-between">
                  <span>Discount:</span>
                  <span>
                    -{discountPaid.toLocaleString()} {asset}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Net Payout Today:</span>
                  <span>
                    {payoutAmount.toLocaleString()} {asset}
                  </span>
                </div>
              </>
            ) : (
              <div className="text-slate-400">
                The invoice will be created without immediate listing.
              </div>
            )}
          </div>
          {immediateList && (
            <SimulationPreview
              details={simDetails}
              isLoading={isSimulating}
              error={simError}
              isFallback={isFallback}
            />
          )}
          {error && (
            <div className="p-3 text-rose-400 text-xs flex gap-2">
              <ShieldAlert className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setStep(1)}
              disabled={isCreating || isListing}
            >
              BACK
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={() => void handleCreate()}
              disabled={isCreating || isListing}
            >
              {isListing
                ? "LISTING..."
                : isCreating
                  ? "CREATING..."
                  : immediateList
                    ? "CREATE & LIST"
                    : "CREATE INVOICE"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
