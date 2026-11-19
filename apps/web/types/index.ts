export type {
  Invoice,
  InvoiceStatus,
  PoolStats,
  LPPosition,
  Profile,
  AssetType,
} from "@trusttrove/sdk";

/** Untyped payload attached to an on-chain event. */
export type EventData = Record<string, unknown>;

export interface EventLog {
  id: number;
  event_id: string;
  contract_id: string;
  ledger: number;
  ledger_closed_at: number;
  event_type: string;
  data: EventData;
}

/**
 * Reads a string field from an event payload.
 *
 * Event data crosses the wire untyped, so consumers must narrow before using
 * it (issue #1096). Missing or non-string fields read as `undefined`.
 */
export function getEventDataString(
  event: EventLog,
  key: string,
): string | undefined {
  const value = event.data[key];
  return typeof value === "string" ? value : undefined;
}

/**
 * Reads a numeric field from an event payload, accepting numbers or numeric
 * strings.
 *
 * @returns The finite number, or `undefined` when the field is missing or not
 *   numeric.
 */
export function getEventDataNumber(
  event: EventLog,
  key: string,
): number | undefined {
  const value = event.data[key];
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/**
 * Reads an integer field from an event payload as a `bigint`, accepting
 * bigints, safe integers, or integer strings.
 *
 * @returns The parsed value, or `undefined` when the field is missing or not
 *   an integer.
 */
export function getEventDataBigInt(
  event: EventLog,
  key: string,
): bigint | undefined {
  const value = event.data[key];
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    return Number.isSafeInteger(value) ? BigInt(value) : undefined;
  }
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    try {
      return BigInt(value.trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
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
