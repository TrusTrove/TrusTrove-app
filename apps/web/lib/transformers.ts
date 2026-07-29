import {
  AssetType,
  Invoice,
  PoolStats,
  LPPosition,
  EventLog,
} from "@/types";

// ── Raw API response interfaces ────────────────────────────────────────────

export interface RawInvoiceResponse {
  id: string;
  issuer: string;
  buyer: string;
  face_value?: string;
  asset?: string;
  discount_bps?: number;
  funded_amount?: string;
  due_date?: number;
  status: string;
  created_at?: number;
  funded_at?: string | number | null;
  shipped_at?: string | number | null;
  issuer_confirmed?: boolean;
  buyer_confirmed?: boolean;
  repaid_at?: string | number | null;
  listed_at?: string | number | null;
  issuer_confirmed_at?: string | number | null;
  buyer_confirmed_at?: string | number | null;
  defaulted_at?: string | number | null;
  transaction_hashes?: string[];
  tx_hashes?: string[];
  created_tx_hash?: string;
  listed_tx_hash?: string;
  funded_tx_hash?: string;
  shipped_tx_hash?: string;
  issuer_confirmed_tx_hash?: string;
  buyer_confirmed_tx_hash?: string;
  repaid_tx_hash?: string;
  defaulted_tx_hash?: string;
}

export interface RawPoolStatsResponse {
  total_deposits?: string;
  total_funded?: string;
  available_liquidity?: string;
  utilization_rate_bps?: number;
  total_yield_distributed?: string;
  active_invoice_count?: number;
  total_shares?: string;
}

export interface RawLPPositionResponse {
  shares?: string;
  usdc_value?: string;
  yield_earned?: string;
  deposit_count?: number;
}

export interface RawEventLogResponse {
  id: number;
  event_id: string;
  contract_id: string;
  ledger: number;
  ledger_closed_at: number;
  event_type: string;
  data?: Record<string, unknown>;
}

// ── Parsers ─────────────────────────────────────────────────────────────────

export function parseRawInvoice(raw: RawInvoiceResponse): Invoice {
  const invoice: Invoice = {
    id: raw.id,
    issuer: raw.issuer,
    buyer: raw.buyer,
    faceValue: BigInt(raw.face_value || 0),
    asset: (raw.asset || "USDC") as AssetType,
    discountBps: Number(raw.discount_bps || 0),
    fundedAmount: BigInt(raw.funded_amount || 0),
    dueDate: Number(raw.due_date || 0),
    status: raw.status,
    createdAt: Number(raw.created_at || 0),
    fundedAt: raw.funded_at ? Number(raw.funded_at) : null,
    shippedAt: raw.shipped_at ? Number(raw.shipped_at) : null,
    issuerConfirmed: !!raw.issuer_confirmed,
    buyerConfirmed: !!raw.buyer_confirmed,
    repaidAt: raw.repaid_at ? Number(raw.repaid_at) : null,
  };

  return Object.assign(invoice, {
    listedAt: raw.listed_at ? Number(raw.listed_at) : null,
    issuerConfirmedAt: raw.issuer_confirmed_at
      ? Number(raw.issuer_confirmed_at)
      : null,
    buyerConfirmedAt: raw.buyer_confirmed_at
      ? Number(raw.buyer_confirmed_at)
      : null,
    defaultedAt: raw.defaulted_at ? Number(raw.defaulted_at) : null,
    transactionHashes: raw.transaction_hashes,
    txHashes: raw.tx_hashes,
    createdTxHash: raw.created_tx_hash,
    listedTxHash: raw.listed_tx_hash,
    fundedTxHash: raw.funded_tx_hash,
    shippedTxHash: raw.shipped_tx_hash,
    issuerConfirmedTxHash: raw.issuer_confirmed_tx_hash,
    buyerConfirmedTxHash: raw.buyer_confirmed_tx_hash,
    repaidTxHash: raw.repaid_tx_hash,
    defaultedTxHash: raw.defaulted_tx_hash,
  });
}

export function parseRawPoolStats(raw: RawPoolStatsResponse): PoolStats {
  return {
    totalDeposits: BigInt(raw.total_deposits || 0),
    totalFunded: BigInt(raw.total_funded || 0),
    availableLiquidity: BigInt(raw.available_liquidity || 0),
    utilizationRateBps: Number(raw.utilization_rate_bps || 0),
    totalYieldDistributed: BigInt(raw.total_yield_distributed || 0),
    activeInvoiceCount: Number(raw.active_invoice_count || 0),
    totalShares: BigInt(raw.total_shares || 0),
  };
}

export function parseRawLPPosition(raw: RawLPPositionResponse): LPPosition {
  return {
    shares: BigInt(raw.shares || 0),
    usdcValue: BigInt(raw.usdc_value || 0),
    yieldEarned: BigInt(raw.yield_earned || 0),
    depositCount: Number(raw.deposit_count || 0),
  };
}

export function parseRawEventLog(raw: RawEventLogResponse): EventLog {
  return {
    id: raw.id,
    event_id: raw.event_id,
    contract_id: raw.contract_id,
    ledger: raw.ledger,
    ledger_closed_at: raw.ledger_closed_at,
    event_type: raw.event_type,
    data: raw.data || {},
  };
}
