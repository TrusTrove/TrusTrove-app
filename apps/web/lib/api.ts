import { useWalletStore } from "@/store/wallet";
import { parseInvoiceResponse } from "@/lib/parsers";
import {
  AssetType,
  Invoice,
  PoolStats,
  LPPosition,
  EventLog,
  PoolSnapshot,
} from "@/types";
class ApiClient {
  private baseUrl: string;
  private token?: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string): void {
    this.token = token;
  }

  async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers || {});

    if (this.token) {
      headers.set("Authorization", `Bearer ${this.token}`);
    }
    if (
      !headers.has("Content-Type") &&
      (options.method === "POST" || options.method === "PUT")
    ) {
      headers.set("Content-Type", "application/json");
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `HTTP error! status: ${res.status}`);
    }

    return res.json() as Promise<T>;
  }
}

const getApiUrl = () => {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";
};

const apiClient = new ApiClient(getApiUrl());

function initApiClientWithToken(): void {
  const token = useWalletStore.getState().token;
  if (token) {
    apiClient.setToken(token);
  }
}

export { ApiClient, apiClient, initApiClientWithToken };

export async function apiFetch<T>(
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
    if (res.status === 503 || res.status === 504) {
      throw new Error(
        text || "Service Temporarily Unavailable. Please try again later.",
      );
    }
    throw new Error(text || `HTTP error! status: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export function parseRawPoolStats(raw: any): PoolStats {
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

export function parseRawLPPosition(raw: any): LPPosition {
  return {
    shares: BigInt(raw.shares || 0),
    usdcValue: BigInt(raw.usdc_value || 0),
    yieldEarned: BigInt(raw.yield_earned || 0),
    depositCount: Number(raw.deposit_count || 0),
  };
}

export function parseRawEventLog(raw: any): EventLog {
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

export async function fetchChallenge(
  address: string,
): Promise<{ transaction: string; network_passphrase: string }> {
  return apiClient.fetch<{ transaction: string; network_passphrase: string }>(
    `/auth?address=${address}`,
  );
}

export async function verifyChallenge(
  transaction: string,
): Promise<{ token: string }> {
  return apiClient.fetch<{ token: string }>("/auth", {
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
  return apiClient.fetch<{
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
  return parseInvoiceResponse(raw);
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

  const raw = await apiClient.fetch<{
    data: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>(`/invoices${query}`);

  return {
    data: raw.data.map(parseInvoiceResponse),
    total: raw.total,
    page: raw.page,
    limit: raw.limit,
    totalPages: raw.totalPages,
  };
}

export async function getPoolStats(): Promise<PoolStats> {
  const raw = await apiClient.fetch<any>("/pool/stats");
  return parseRawPoolStats(raw);
}

export async function getLPPosition(address: string): Promise<LPPosition> {
  const raw = await apiClient.fetch<any>(`/pool/position/${address}`);
  return parseRawLPPosition(raw);
}

export async function getRecentEvents(limit?: number): Promise<EventLog[]> {
  const query = limit ? `?limit=${limit}` : "";
  const rawList = await apiClient.fetch<any[]>(`/events${query}`);
  return rawList.map(parseRawEventLog);
}

export async function getPoolSnapshots(): Promise<PoolSnapshot[]> {
  return apiClient.fetch<PoolSnapshot[]>("/pool/snapshots");
}

export interface ProtocolStats {
  total_usdc_financed: string;
  active_invoice_count: number;
  total_invoices: number;
  total_repaid: number;
  total_defaulted: number;
  average_yield_bps: number;
  pool_utilization_bps: number;
  registered_issuers: number;
}

export async function getProtocolStats(): Promise<ProtocolStats> {
  return apiClient.fetch<ProtocolStats>("/stats");
}
