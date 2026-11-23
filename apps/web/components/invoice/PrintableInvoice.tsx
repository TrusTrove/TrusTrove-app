"use client";

import React from "react";
import { Invoice } from "@/types";
import { InvoiceStatus } from "./InvoiceStatus";
import { formatAmount } from "@/lib/assets";

interface PrintableInvoiceProps {
  invoice: Invoice;
  contractId?: string;
}

export function PrintableInvoice({
  invoice,
  contractId = process.env.NEXT_PUBLIC_INVOICE_CONTRACT_ID || "-",
}: PrintableInvoiceProps) {
  const txRefs = [
    { label: "Created", hash: (invoice as any).createdTxHash || (invoice as any).transactionHashes?.created },
    { label: "Funded", hash: (invoice as any).fundedTxHash || (invoice as any).transactionHashes?.funded },
    { label: "Shipped", hash: (invoice as any).shippedTxHash || (invoice as any).transactionHashes?.shipped },
    { label: "Confirmed", hash: (invoice as any).confirmedTxHash || (invoice as any).transactionHashes?.confirmed },
    { label: "Repaid", hash: (invoice as any).repaidTxHash || (invoice as any).transactionHashes?.repaid },
  ].filter((item) => Boolean(item.hash));

  return (
    <div className="print:block bg-white text-slate-900 p-8 max-w-3xl mx-auto font-sans" data-testid="printable-invoice">
      <div className="flex justify-between items-start border-b border-slate-200 pb-6 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">INVOICE REVIEW ARTIFACT</h1>
          <p className="text-xs font-mono text-slate-500 mt-1">Invoice ID: {invoice.id}</p>
        </div>
        <div className="text-right">
          <div className="inline-block">
            <InvoiceStatus status={invoice.status} />
          </div>
          <p className="text-xs font-mono text-slate-500 mt-2">Contract ID: {contractId}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8 text-sm">
        <div className="border border-slate-200 p-4 rounded-lg bg-slate-50">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Issuer Party</h3>
          <p className="font-mono text-xs break-all text-slate-900">{invoice.issuer}</p>
        </div>
        <div className="border border-slate-200 p-4 rounded-lg bg-slate-50">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Buyer Party</h3>
          <p className="font-mono text-xs break-all text-slate-900">{invoice.buyer}</p>
        </div>
      </div>

      <div className="border border-slate-200 rounded-lg p-6 mb-8 bg-slate-50 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <span className="text-sm text-slate-600 font-medium">Face Value</span>
          <span className="text-lg font-bold font-mono text-slate-900">
            {formatAmount(invoice.faceValue)} {invoice.asset}
          </span>
        </div>
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <span className="text-sm text-slate-600 font-medium">Discount Rate</span>
          <span className="text-sm font-mono text-slate-900">{(invoice.discountBps / 100).toFixed(2)}%</span>
        </div>
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <span className="text-sm text-slate-600 font-medium">Funded Amount</span>
          <span className="text-sm font-mono text-slate-900">
            {formatAmount(invoice.fundedAmount)} {invoice.asset}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-600 font-medium">Due Date</span>
          <span className="text-sm font-mono text-slate-900">
            {new Date(invoice.dueDate * 1000).toLocaleDateString()}
          </span>
        </div>
      </div>

      {txRefs.length > 0 && (
        <div className="border border-slate-200 rounded-lg p-6 bg-slate-50">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Transaction References</h3>
          <ul className="space-y-2 font-mono text-xs">
            {txRefs.map((ref) => (
              <li key={ref.label} className="flex justify-between items-center">
                <span className="text-slate-600 font-bold">{ref.label}:</span>
                <span className="text-slate-900 break-all bg-white px-2 py-1 rounded border border-slate-200">
                  {ref.hash}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
