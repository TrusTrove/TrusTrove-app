export type {
  InvoiceStatus,
  PoolStats,
  LPPosition,
  Profile,
  AssetType,
} from "@trusttrove/sdk";

import type { Invoice as SdkInvoice } from "@trusttrove/sdk";

// Extend the SDK Invoice type with extra fields that parseInvoiceResponse adds at runtime
// These fields are attached via Object.assign() so they are optional on the type
export interface Invoice extends SdkInvoice {
  listedAt?: number | null;
  issuerConfirmedAt?: number | null;
  buyerConfirmedAt?: number | null;
  defaultedAt?: number | null;
  transactionHashes?: string[];
  txHashes?: string[];
  createdTxHash?: string;
  listedTxHash?: string;
  fundedTxHash?: string;
  shippedTxHash?: string | null;
  issuerConfirmedTxHash?: string | null;
  buyerConfirmedTxHash?: string | null;
  repaidTxHash?: string | null;
  defaultedTxHash?: string | null;
}

export interface EventLog {
  id: number;
  event_id: string;
  contract_id: string;
  ledger: number;
  ledger_closed_at: number;
  event_type: string;
  data: Record<string, any>;
}

export interface PoolSnapshot {
  timestamp: number;
  utilizationRateBps: number;
  totalYieldDistributed: string;
}

export interface TxHistoryItem {
  id: string;
  type: string;
  amount?: string;
  token?: string;
  timestamp: number;
  hash: string;
  status: "success" | "failed";
}
