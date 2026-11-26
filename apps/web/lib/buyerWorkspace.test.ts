import { describe, expect, it } from "vitest";
import type { Invoice, InvoiceStatus } from "@/types";
import {
  countActionableInvoices,
  filterBuyerInvoices,
  groupBuyerInvoices,
  isValidBuyerAddress,
} from "./buyerWorkspace";

const BUYER = "GDSCOJVNZ4JUVWZ5O6VBTUGOH4ZE22QJ6WMOYWHB3FEDQ2APJ2RQEIHY";
const OTHER_BUYER = "GCV5ODH3SMUDETURTOQPQ7TD2YI4YS6DZMMXDFLSWLGBFZTCHYL6LDNW";
const NOW = 1_800_000_000;

function makeInvoice(
  id: string,
  status: InvoiceStatus,
  overrides: Partial<Invoice> = {},
): Invoice {
  return {
    id,
    issuer: OTHER_BUYER,
    buyer: BUYER,
    faceValue: 1_000_000_000n,
    asset: "USDC",
    discountBps: 200,
    fundedAmount: 980_000_000n,
    dueDate: NOW + 86_400,
    status,
    createdAt: NOW - 86_400,
    fundedAt: NOW - 3600,
    shippedAt: null,
    issuerConfirmed: false,
    buyerConfirmed: false,
    repaidAt: null,
    ...overrides,
  };
}

describe("isValidBuyerAddress", () => {
  it("accepts a Stellar account address", () => {
    expect(isValidBuyerAddress(BUYER)).toBe(true);
  });

  it("rejects missing, malformed, and contract addresses", () => {
    expect(isValidBuyerAddress(undefined)).toBe(false);
    expect(isValidBuyerAddress(null)).toBe(false);
    expect(isValidBuyerAddress("")).toBe(false);
    expect(isValidBuyerAddress("not-an-address")).toBe(false);
    expect(isValidBuyerAddress(BUYER.toLowerCase())).toBe(false);
    // Contract ids use the C prefix and are not account addresses.
    expect(
      isValidBuyerAddress(
        "CAKEWH7SJCXGV2MH2WZYIX3QDPTSSBQFXYVYBOWAGLNBBZMPLE2US6CS",
      ),
    ).toBe(false);
  });
});

describe("filterBuyerInvoices", () => {
  it("keeps only invoices addressed to the connected buyer", () => {
    const mine = makeInvoice("mine", "Active");
    const theirs = makeInvoice("theirs", "Active", { buyer: OTHER_BUYER });

    expect(filterBuyerInvoices([mine, theirs], BUYER)).toEqual([mine]);
  });

  it("returns nothing for a missing or invalid address", () => {
    const invoices = [makeInvoice("mine", "Active")];

    expect(filterBuyerInvoices(invoices, null)).toEqual([]);
    expect(filterBuyerInvoices(invoices, "bogus")).toEqual([]);
  });

  it("returns an empty list for an empty invoice set", () => {
    expect(filterBuyerInvoices([], BUYER)).toEqual([]);
  });
});

describe("groupBuyerInvoices", () => {
  it("groups a buyer's invoices by next action in work order", () => {
    const groups = groupBuyerInvoices(
      [
        makeInvoice("closed", "Repaid"),
        makeInvoice("pending", "Listed"),
        makeInvoice("shipped", "Active"),
        makeInvoice("financed", "Funded"),
        makeInvoice("repay", "Confirmed"),
        makeInvoice("late", "Confirmed", { dueDate: NOW - 1 }),
      ],
      BUYER,
      NOW,
    );

    expect(groups.map((group) => group.key)).toEqual([
      "overdue",
      "repay",
      "confirm-delivery",
      "awaiting-shipment",
      "awaiting-financing",
      "closed",
    ]);
    expect(groups.find((group) => group.key === "overdue")?.invoices).toEqual([
      expect.objectContaining({ id: "late" }),
    ]);
  });

  it("never includes another buyer's invoices", () => {
    const groups = groupBuyerInvoices(
      [makeInvoice("theirs", "Active", { buyer: OTHER_BUYER })],
      BUYER,
      NOW,
    );

    expect(groups).toEqual([]);
  });

  it("omits empty groups and sorts each group by due date", () => {
    const groups = groupBuyerInvoices(
      [
        makeInvoice("later", "Active", { dueDate: NOW + 172_800 }),
        makeInvoice("sooner", "Active", { dueDate: NOW + 3600 }),
      ],
      BUYER,
      NOW,
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("confirm-delivery");
    expect(groups[0].invoices.map((invoice) => invoice.id)).toEqual([
      "sooner",
      "later",
    ]);
  });

  it("returns no groups when the buyer has no invoices", () => {
    expect(groupBuyerInvoices([], BUYER, NOW)).toEqual([]);
  });
});

describe("countActionableInvoices", () => {
  it("counts invoices needing confirmation or repayment only", () => {
    const groups = groupBuyerInvoices(
      [
        makeInvoice("shipped", "Active"),
        makeInvoice("repay", "Confirmed"),
        makeInvoice("pending", "Created"),
        makeInvoice("closed", "Defaulted"),
      ],
      BUYER,
      NOW,
    );

    expect(countActionableInvoices(groups)).toBe(2);
  });
});
