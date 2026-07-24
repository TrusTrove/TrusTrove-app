import { invoiceSchema } from "@trusttrove/sdk";
import type { Invoice, AssetType } from "@/types";

function normalizeKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj ?? {})) {
    const camelKey = key.replace(/_([a-z0-9])/g, (_, letter) =>
      letter.toUpperCase(),
    );
    result[camelKey] = value;
  }
  return result;
}

function manuallyParse(raw: any): Invoice {
  return {
    id: raw.id,
    issuer: raw.issuer,
    buyer: raw.buyer,
    faceValue: BigInt(raw.face_value ?? raw.faceValue ?? 0),
    asset: (raw.asset || "USDC") as AssetType,
    discountBps: Number(raw.discount_bps ?? raw.discountBps ?? 0),
    fundedAmount: BigInt(raw.funded_amount ?? raw.fundedAmount ?? 0),
    dueDate: Number(raw.due_date ?? raw.dueDate ?? 0),
    status: raw.status,
    createdAt: Number(raw.created_at ?? raw.createdAt ?? 0),
    fundedAt:
      (raw.funded_at ?? raw.fundedAt)
        ? Number(raw.funded_at ?? raw.fundedAt)
        : null,
    shippedAt:
      (raw.shipped_at ?? raw.shippedAt)
        ? Number(raw.shipped_at ?? raw.shippedAt)
        : null,
    issuerConfirmed: !!(raw.issuer_confirmed ?? raw.issuerConfirmed),
    buyerConfirmed: !!(raw.buyer_confirmed ?? raw.buyerConfirmed),
    repaidAt:
      (raw.repaid_at ?? raw.repaidAt)
        ? Number(raw.repaid_at ?? raw.repaidAt)
        : null,
  };
}

function extraFields(raw: any) {
  return {
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
  };
}

export function parseInvoiceResponse(raw: any): Invoice {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid invoice payload");
  }

  const normalized = normalizeKeys(raw);
  const parsed = invoiceSchema.safeParse(normalized);

  const invoice: Invoice = parsed.success
    ? (parsed.data as unknown as Invoice)
    : manuallyParse(raw);

  return Object.assign(invoice, extraFields(raw));
}
