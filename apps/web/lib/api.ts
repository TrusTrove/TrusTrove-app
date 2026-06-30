import { useWalletStore } from "@/store/wallet";
import {
  AssetType,
  Invoice,
  PoolStats,
  LPPosition,
  EventLog,
  PoolSnapshot,
} from "@/types";

const getApiUrl = () => {
  return process.env.NEXT_PUBLIC_INDEXER_API_URL || "http://localhost:8080";
};

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = useWalletStore.getState().token;
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (
    !headers.has("Content-Type") &&
    (options.method === "POST" || options.method === "PUT")
  ) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${getApiUrl()}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP error! status: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

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

export async function fetchChallenge(
  address: string,
): Promise<{ transaction: string; network_passphrase: string }> {
  return apiFetch<{ transaction: string; network_passphrase: string }>(
    `/auth?address=${address}`,
  );
}

export async function verifyChallenge(
  transaction: string,
): Promise<{ token: string }> {
  return apiFetch<{ token: string }>("/auth", {
    method: "POST",
    body: JSON.stringify({ transaction }),
  });
}

export async function createInvoice(
  buyer: string,
  faceValue: string,
  dueDate: number,
  asset: AssetType = "USDC",
): Promise<{ invoice_id: string; transaction_hash: string; status: string }> {
  return apiFetch<{
    invoice_id: string;
    transaction_hash: string;
    status: string;
  }>("/invoices", {
    method: "POST",
    body: JSON.stringify({
      buyer,
      face_value: faceValue,
      due_date: dueDate,
      asset,
    }),
  });
}

export async function getInvoiceByID(id: string): Promise<Invoice> {
  const raw = await apiFetch<any>(`/invoices/${id}`);
  return parseRawInvoice(raw);
}

export interface PaginatedInvoices {
  data: Invoice[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function getInvoices(filters?: {
  status?: string;
  issuer?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedInvoices> {
  const params = new URLSearchParams();
  if (filters?.status) params.append("status", filters.status);
  if (filters?.issuer) params.append("issuer", filters.issuer);
  if (filters?.page != null) params.append("page", String(filters.page));
  if (filters?.limit != null) params.append("limit", String(filters.limit));
  const query = params.size > 0 ? `?${params.toString()}` : "";

  const raw = await apiFetch<{
    data: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>(`/invoices${query}`);

  return {
    data: raw.data.map(parseRawInvoice),
    total: raw.total,
    page: raw.page,
    limit: raw.limit,
    totalPages: raw.totalPages,
  };
}

export async function getPoolStats(): Promise<PoolStats> {
  const raw = await apiFetch<any>("/pool/stats");
  return parseRawPoolStats(raw);
}

export async function getLPPosition(address: string): Promise<LPPosition> {
  const raw = await apiFetch<any>(`/pool/position/${address}`);
  return parseRawLPPosition(raw);
}

export async function getRecentEvents(limit?: number): Promise<EventLog[]> {
  const query = limit ? `?limit=${limit}` : "";
  const rawList = await apiFetch<any[]>(`/events${query}`);
  return rawList.map(parseRawEventLog);
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

export async function getPoolSnapshots(): Promise<PoolSnapshot[]> {
  return apiFetch<PoolSnapshot[]>("/pool/snapshots");
}
