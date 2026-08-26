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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toBigInt(val: unknown): bigint {
  if (typeof val === "bigint") return val;
  if (typeof val === "number") return BigInt(val);
  if (typeof val === "string") return BigInt(val);
  return 0n;
}

function toNumber(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "bigint") return Number(val);
  if (typeof val === "string") return Number(val);
  return 0;
}

export function parseRawPoolStats(raw: unknown): PoolStats {
  const r = isRecord(raw) ? raw : {};
  return {
    totalDeposits: toBigInt(r.total_deposits),
    totalFunded: toBigInt(r.total_funded),
    availableLiquidity: toBigInt(r.available_liquidity),
    utilizationRateBps: toNumber(r.utilization_rate_bps),
    totalYieldDistributed: toBigInt(r.total_yield_distributed),
    activeInvoiceCount: toNumber(r.active_invoice_count),
    totalShares: toBigInt(r.total_shares),
  };
}

export function parseRawLPPosition(raw: unknown): LPPosition {
  const r = isRecord(raw) ? raw : {};
  return {
    shares: toBigInt(r.shares),
    usdcValue: toBigInt(r.usdc_value),
    yieldEarned: toBigInt(r.yield_earned),
    depositCount: toNumber(r.deposit_count),
  };
}

export function parseRawEventLog(raw: unknown): EventLog {
  const r = isRecord(raw) ? raw : {};
  return {
    id: toNumber(r.id),
    event_id: String(r.event_id ?? ""),
    contract_id: String(r.contract_id ?? ""),
    ledger: toNumber(r.ledger),
    ledger_closed_at: toNumber(r.ledger_closed_at),
    event_type: String(r.event_type ?? ""),
    data: (r.data as Record<string, unknown>) || {},
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
