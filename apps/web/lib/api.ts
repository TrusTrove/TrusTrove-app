import { useWalletStore } from "@/store/wallet";
import {
  AssetType,
  Invoice,
  PoolStats,
  LPPosition,
  EventLog,
  PoolSnapshot,
} from "@/types";
import {
  parseRawInvoice,
  parseRawPoolStats,
  parseRawLPPosition,
  parseRawEventLog,
} from "./transformers";

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

export async function getPoolSnapshots(): Promise<PoolSnapshot[]> {
  return apiFetch<PoolSnapshot[]>("/pool/snapshots");
}
