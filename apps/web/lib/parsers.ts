import { invoiceSchema } from "@trusttrove/sdk";
import type { Invoice, AssetType } from "@/types";

type RawInvoice = Record<string, unknown>;

function isRecord(value: unknown): value is RawInvoice {
  return typeof value === "object" && value !== null;
}

function normalizeKeys(obj: RawInvoice): RawInvoice {
  const result: RawInvoice = {};
  for (const [key, value] of Object.entries(obj ?? {})) {
    const camelKey = key.replace(/_([a-z0-9])/g, (_, letter) =>
      letter.toUpperCase(),
    );
    result[camelKey] = value;
  }
  return result;
}

function toBigInt(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" || typeof value === "string") {
    return BigInt(value);
  }
  return 0n;
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint" || typeof value === "string") {
    return Number(value);
  }
  return Number(value);
}

function toNullableNumber(value: unknown): number | null {
  return value ? toNumber(value) : null;
}

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function manuallyParse(raw: RawInvoice): Invoice {
  const assetValue = raw.asset || "USDC";
  const asset: AssetType = assetValue === "XLM" ? "XLM" : "USDC";

  return {
    id: toStringValue(raw.id),
    issuer: toStringValue(raw.issuer),
    buyer: toStringValue(raw.buyer),
    faceValue: toBigInt(raw.face_value ?? raw.faceValue ?? 0),
    asset,
    discountBps: toNumber(raw.discount_bps ?? raw.discountBps ?? 0),
    fundedAmount: toBigInt(raw.funded_amount ?? raw.fundedAmount ?? 0),
    dueDate: toNumber(raw.due_date ?? raw.dueDate ?? 0),
    status: toStringValue(raw.status) as Invoice["status"],
    createdAt: toNumber(raw.created_at ?? raw.createdAt ?? 0),
    fundedAt: toNullableNumber(raw.funded_at ?? raw.fundedAt),
    shippedAt: toNullableNumber(raw.shipped_at ?? raw.shippedAt),
    issuerConfirmed: !!(raw.issuer_confirmed ?? raw.issuerConfirmed),
    buyerConfirmed: !!(raw.buyer_confirmed ?? raw.buyerConfirmed),
    repaidAt: toNullableNumber(raw.repaid_at ?? raw.repaidAt),
  };
}

function extraFields(raw: RawInvoice) {
  return {
    listedAt: raw.listed_at ? toNumber(raw.listed_at) : null,
    issuerConfirmedAt: raw.issuer_confirmed_at
      ? toNumber(raw.issuer_confirmed_at)
      : null,
    buyerConfirmedAt: raw.buyer_confirmed_at
      ? toNumber(raw.buyer_confirmed_at)
      : null,
    defaultedAt: raw.defaulted_at ? toNumber(raw.defaulted_at) : null,
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
  };
}

export function parseInvoiceResponse(raw: unknown): Invoice {
  if (!isRecord(raw)) {
    throw new Error("Invalid invoice payload");
  }

  const normalized = normalizeKeys(raw);
  const parsed = invoiceSchema.safeParse(normalized);

  const invoice: Invoice = parsed.success
    ? (parsed.data as unknown as Invoice)
    : manuallyParse(raw);

  return Object.assign(invoice, extraFields(raw));
}
