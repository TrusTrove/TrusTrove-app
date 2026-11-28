import React from 'react';
import { Invoice } from '@trusttrove/sdk';

export interface PrintableInvoiceProps {
  invoice: Invoice & { contractId?: string; txHash?: string };
}

export const PrintableInvoice: React.FC<PrintableInvoiceProps> = ({ invoice }) => {
  return (
    <div className="p-8 bg-white text-black font-sans max-w-4xl mx-auto print:p-0">
      <div className="flex justify-between items-center border-b pb-4 mb-6">
        <h1 className="text-2xl font-bold">Invoice Detail & Summary</h1>
        <div className="text-right text-sm text-gray-600">
          <div>ID: {invoice.id}</div>
          <div>Status: <span className="font-semibold">{invoice.status}</span></div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <h3 className="text-gray-500 text-xs uppercase tracking-wider mb-1">Issuer</h3>
          <p className="font-mono text-sm break-all">{invoice.issuer}</p>
        </div>
        <div>
          <h3 className="text-gray-500 text-xs uppercase tracking-wider mb-1">Buyer</h3>
          <p className="font-mono text-sm break-all">{invoice.buyer}</p>
        </div>
      </div>

      <div className="border-t border-b py-4 my-6">
        <div className="flex justify-between py-2">
          <span className="text-gray-600">Face Value</span>
          <span className="font-bold">{invoice.faceValue.toString()} stroops ({invoice.asset})</span>
        </div>
        <div className="flex justify-between py-2">
          <span className="text-gray-600">Discount</span>
          <span>{invoice.discountBps / 100}%</span>
        </div>
        <div className="flex justify-between py-2">
          <span className="text-gray-600">Due Date</span>
          <span>{new Date(invoice.dueDate * 1000).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="text-sm text-gray-600 space-y-2">
        {invoice.contractId && (
          <div>
            <span className="font-semibold">Contract ID:</span> <span className="font-mono">{invoice.contractId}</span>
        </div>
      )}
        {invoice.txHash && (
          <div>
            <span className="font-semibold">Transaction Reference:</span> <span className="font-mono">{invoice.txHash}</span>
    </div>
        )}
      </div>
    </div>
  );
};
