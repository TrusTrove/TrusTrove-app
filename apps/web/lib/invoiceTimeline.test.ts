import { describe, it, expect } from "vitest";
import { truncateTxHash, buildInvoiceTimeline } from "./invoiceTimeline";
import type { Invoice } from "@/types";

const BASE_INVOICE: Invoice = {
  id: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
  issuer: "GCXQ2E3F6V3J6X6L6X6L6X6L6X6L6X6L6X6L6X6L6X6L6X6L6X6L6X6L6",
  buyer: "GCXQ2E3F6V3J6X6L6X6L6X6L6X6L6X6L6X6L6X6L6X6L6X6L6X6L6X6L6",
  faceValue: 10000000000n,
  asset: "USDC",
  discountBps: 200,
  fundedAmount: 0n,
  dueDate: 1735689600,
  status: "Created",
  createdAt: 1735603200,
  fundedAt: null,
  shippedAt: null,
  issuerConfirmed: false,
  buyerConfirmed: false,
  repaidAt: null,
};

describe("truncateTxHash", () => {
  // #1094: a 64-char hash shortens to first8...last6.
  it("shortens a 64-char hash to first8...last6", () => {
    const hash = "a".repeat(64);
    expect(truncateTxHash(hash)).toBe("aaaaaaaa...aaaaaa");
  });

  it("shortens a mixed 64-char hash", () => {
    const hash =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    expect(truncateTxHash(hash)).toBe("01234567...abcdef");
  });

  // #1094: short hashes must not echo a duplicated substring.
  it("returns a short hash unchanged without duplicating a substring", () => {
    const short = "abcdef";
    expect(truncateTxHash(short)).toBe("abcdef");
    expect(truncateTxHash(short)).not.toBe("abcdef...abcdef");
  });

  it("returns an empty string unchanged", () => {
    expect(truncateTxHash("")).toBe("");
  });

  it("returns a 14-char hash unchanged (slices would just touch)", () => {
    const hash = "0123456789abcd"; // length 14
    expect(truncateTxHash(hash)).toBe("0123456789abcd");
  });

  it("truncates a 15-char hash (slices no longer overlap)", () => {
    const hash = "0123456789abcdefg"; // length 15
    expect(truncateTxHash(hash)).toBe("01234567...bcdefg");
  });
});

describe("buildInvoiceTimeline", () => {
  it("builds one entry per timeline step in order", () => {
    const timeline = buildInvoiceTimeline(BASE_INVOICE);
    expect(timeline).toHaveLength(7);
    expect(timeline.map((step) => step.key)).toEqual([
      "created",
      "listed",
      "funded",
      "shipped",
      "issuerConfirmed",
      "buyerConfirmed",
      "settled",
    ]);
  });

  it("marks the created step as current for a Created invoice", () => {
    const timeline = buildInvoiceTimeline(BASE_INVOICE);
    expect(timeline[0].isCurrent).toBe(true);
    expect(timeline[0].isComplete).toBe(true);
    expect(timeline[1].isCurrent).toBe(false);
  });

  it("resolves the settled label to Repaid for a Repaid invoice", () => {
    const timeline = buildInvoiceTimeline({
      ...BASE_INVOICE,
      status: "Repaid",
    });
    const settled = timeline[timeline.length - 1];
    expect(settled.label).toBe("Repaid");
  });

  it("resolves the settled label to Defaulted for a Defaulted invoice", () => {
    const timeline = buildInvoiceTimeline({
      ...BASE_INVOICE,
      status: "Defaulted",
    });
    const settled = timeline[timeline.length - 1];
    expect(settled.label).toBe("Defaulted");
  });
});
