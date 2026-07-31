export type {
  Invoice,
  InvoiceStatus,
  PoolStats,
  LPPosition,
  Profile,
  AssetType,
} from "@trusttrove/sdk";

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
