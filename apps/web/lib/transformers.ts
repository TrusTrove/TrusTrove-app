import {
  AssetType,
  Invoice,
  PoolStats,
  LPPosition,
  EventLog,
  PoolSnapshot,
} from "@/types";

function parseRawInvoice(raw: any): Invoice {
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

function parseRawPoolStats(raw: any): PoolStats {
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

function parseRawLPPosition(raw: any): LPPosition {
  return {
    shares: BigInt(raw.shares || 0),
    usdcValue: BigInt(raw.usdc_value || 0),
    yieldEarned: BigInt(raw.yield_earned || 0),
    depositCount: Number(raw.deposit_count || 0),
  };
}

function parseRawEventLog(raw: any): EventLog {
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