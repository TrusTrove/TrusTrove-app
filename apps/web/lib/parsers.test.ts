import { describe, it, expect } from "vitest";
import { parseInvoiceResponse } from "./parsers";

const VALID_RAW = {
  id: "abcd1234",
  issuer: "GCXQ2E3F6V3J6X6L6X6L6X6L6X6L6X6L6X6L6X6L6X6L6X6L6X6L6X6L6",
  buyer: "GCXQ2E3F6V3J6X6L6X6L6X6L6X6L6X6L6X6L6X6L6X6L6X6L6X6L6X6L6",
  face_value: "10000000000",
  asset: "USDC",
  discount_bps: 200,
  funded_amount: "8000000000",
  due_date: 1735689600,
  status: "Funded",
  created_at: 1735603200,
  funded_at: 1735603200,
  shipped_at: null,
  issuer_confirmed: true,
  buyer_confirmed: false,
  repaid_at: null,
  listed_at: 1735603200,
  issuer_confirmed_at: null,
  buyer_confirmed_at: null,
  defaulted_at: null,
  transaction_hashes: ["hash1"],
  tx_hashes: ["txhash1"],
  created_tx_hash: "created_tx_hash_val",
  listed_tx_hash: "listed_tx_hash_val",
  funded_tx_hash: "funded_tx_hash_val",
  shipped_tx_hash: null,
  issuer_confirmed_tx_hash: null,
  buyer_confirmed_tx_hash: null,
  repaid_tx_hash: null,
  defaulted_tx_hash: null,
};

describe("parseInvoiceResponse", () => {
  it("parses a valid invoice from snake_case API response", () => {
    const result = parseInvoiceResponse(VALID_RAW);

    expect(result.id).toBe("abcd1234");
    expect(result.issuer).toBe(
      "GCXQ2E3F6V3J6X6L6X6L6X6L6X6L6X6L6X6L6X6L6X6L6X6L6X6L6X6L6",
    );
    expect(result.faceValue).toBe(10000000000n);
    expect(result.asset).toBe("USDC");
    expect(result.discountBps).toBe(200);
    expect(result.fundedAmount).toBe(8000000000n);
    expect(result.dueDate).toBe(1735689600);
    expect(result.status).toBe("Funded");
    expect(result.createdAt).toBe(1735603200);
    expect(result.fundedAt).toBe(1735603200);
    expect(result.shippedAt).toBeNull();
    expect(result.issuerConfirmed).toBe(true);
    expect(result.buyerConfirmed).toBe(false);
    expect(result.repaidAt).toBeNull();
  });

  it("parses from camelCase keys (already normalized)", () => {
    const camelInput = {
      id: "inv1",
      issuer: "GCXQ2E3F6V3J6X6L6X6L6X6L6X6L6X6L6X6L6X6L6X6L6X6L6X6L6X6L6",
      buyer: "GCXQ2E3F6V3J6X6L6X6L6X6L6X6L6X6L6X6L6X6L6X6L6X6L6X6L6X6L6",
      faceValue: "5000000000",
      asset: "XLM",
      discountBps: 150,
      fundedAmount: "4000000000",
      dueDate: 1735689600,
      status: "Active",
      createdAt: 1735603200,
      fundedAt: 1735603200,
      shippedAt: null,
      issuerConfirmed: false,
      buyerConfirmed: true,
      repaidAt: null,
    };

    const result = parseInvoiceResponse(camelInput);
    expect(result.faceValue).toBe(5000000000n);
    expect(result.asset).toBe("XLM");
    expect(result.discountBps).toBe(150);
    expect(result.status).toBe("Active");
    expect(result.issuerConfirmed).toBe(false);
    expect(result.buyerConfirmed).toBe(true);
  });

  it("preserves extra fields (tx hashes, timestamps)", () => {
    const result = parseInvoiceResponse(VALID_RAW);

    expect(result.listedAt).toBe(1735603200);
    expect(result.issuerConfirmedAt).toBeNull();
    expect(result.buyerConfirmedAt).toBeNull();
    expect(result.defaultedAt).toBeNull();
    expect(result.transactionHashes).toEqual(["hash1"]);
    expect(result.txHashes).toEqual(["txhash1"]);
    expect(result.createdTxHash).toBe("created_tx_hash_val");
    expect(result.listedTxHash).toBe("listed_tx_hash_val");
    expect(result.fundedTxHash).toBe("funded_tx_hash_val");
    expect(result.shippedTxHash).toBeNull();
  });

  it("coerces null funded_amount to 0n", () => {
    const result = parseInvoiceResponse({
      ...VALID_RAW,
      funded_amount: null,
    });
    expect(result.fundedAmount).toBe(0n);
  });

  it("coerces missing discount_bps to 0", () => {
    const { discount_bps: _discount, ...withoutDiscount } = VALID_RAW;
    void _discount;
    const result = parseInvoiceResponse(withoutDiscount);
    expect(result.discountBps).toBe(0);
  });

  it("coerces issuer_confirmed and buyer_confirmed to boolean", () => {
    const result = parseInvoiceResponse({
      ...VALID_RAW,
      issuer_confirmed: 1,
      buyer_confirmed: 0,
    });
    expect(result.issuerConfirmed).toBe(true);
    expect(result.buyerConfirmed).toBe(false);
  });

  it("defaults asset to USDC when missing", () => {
    const { asset: _, ...withoutAsset } = VALID_RAW;
    const result = parseInvoiceResponse(withoutAsset);
    expect(result.asset).toBe("USDC");
  });

  it("throws for null input", () => {
    expect(() => parseInvoiceResponse(null)).toThrow("Invalid invoice payload");
  });

  it("throws for undefined input", () => {
    expect(() => parseInvoiceResponse(undefined)).toThrow(
      "Invalid invoice payload",
    );
  });

  it("throws for non-object input", () => {
    expect(() => parseInvoiceResponse("not-an-object")).toThrow(
      "Invalid invoice payload",
    );
  });

  it("handles BigInt coercion for face_value", () => {
    const result = parseInvoiceResponse({
      ...VALID_RAW,
      face_value: "9999999999999999999",
    });
    expect(result.faceValue).toBe(9999999999999999999n);
    expect(typeof result.faceValue).toBe("bigint");
  });

  it("handles empty string nullable fields as null", () => {
    const result = parseInvoiceResponse({
      ...VALID_RAW,
      funded_at: "",
      shipped_at: "",
      repaid_at: "",
    });
    expect(result.fundedAt).toBeNull();
    expect(result.shippedAt).toBeNull();
    expect(result.repaidAt).toBeNull();
  });

  it("handles missing optional nullable fields as null", () => {
    const {
      funded_at: _f,
      shipped_at: _s,
      repaid_at: _r,
      ...partial
    } = VALID_RAW;
    void _f;
    void _s;
    void _r;
    const result = parseInvoiceResponse(partial);
    expect(result.fundedAt).toBeNull();
    expect(result.shippedAt).toBeNull();
    expect(result.repaidAt).toBeNull();
  });

  it("falls back to manual parsing on schema validation failure", () => {
    // Invalid status enum that fails SDK schema but is preserved by fallback
    const result = parseInvoiceResponse({
      ...VALID_RAW,
      status: "UnknownStatus",
    });
    expect(result.status).toBe("UnknownStatus");
    // Other fields should still be correctly coerced
    expect(result.faceValue).toBe(10000000000n);
    expect(result.asset).toBe("USDC");
  });
});
