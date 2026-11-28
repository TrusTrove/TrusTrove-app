import React from 'react';
import { render, screen } from '@testing-library/react';
import { PrintableInvoice } from './PrintableInvoice';
import type { Invoice } from "../../types";

describe('PrintableInvoice', () => {
  const mockInvoice = {
    id: 'inv-123',
    issuer: 'G_ISSUER',
    buyer: 'G_BUYER',
    faceValue: 100000000n,
    asset: 'USDC' as const,
    discountBps: 100,
    fundedAmount: 100000000n,
    dueDate: Date.now() / 1000 + 86400,
    status: 'Active' as const,
    createdAt: Date.now() / 1000,
    fundedAt: Date.now() / 1000,
    shippedAt: null,
    issuerConfirmed: true,
    buyerConfirmed: false,
    repaidAt: null,
    contractId: 'C_CONTRACT',
    txHash: 'tx_hash_123',
  };

  it('renders invoice details correctly for print', () => {
    render(<PrintableInvoice invoice={mockInvoice} />);
    expect(screen.getByText('G_ISSUER')).toBeInTheDocument();
    expect(screen.getByText('G_BUYER')).toBeInTheDocument();
    expect(screen.getByText('C_CONTRACT')).toBeInTheDocument();
    expect(screen.getByText('tx_hash_123')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });
});


const sampleInvoice: Invoice = {
  id: "inv-print-001",
  status: "Funded",
  issuer: "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
  buyer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  faceValue: 1000000000n,
  asset: "USDC",
  discountBps: 250,
  fundedAmount: 1000000000n,
  dueDate: 1_735_689_600,
  createdAt: 1_735_430_400,
  fundedAt: 1_735_431_400,
  shippedAt: null,
  issuerConfirmed: false,
  buyerConfirmed: false,
  repaidAt: null,
  createdTxHash: "0xabc123created",
  fundedTxHash: "0xdef456funded",
} as any;
