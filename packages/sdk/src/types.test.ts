import { describe, it, expect } from "vitest";
import {
  invoiceStatusTransitionMap,
  allowedActions,
  isTransitionAllowed,
  InvoiceStatus,
} from "./types/index.js";

describe("invoiceStatusTransitionMap", () => {
  it("has transitions defined for every InvoiceStatus", () => {
    const statuses: InvoiceStatus[] = [
      "Created",
      "Listed",
      "Funded",
      "Active",
      "Confirmed",
      "Repaid",
      "Defaulted",
    ];

    for (const status of statuses) {
      const transitions = invoiceStatusTransitionMap.get(status);
      expect(transitions).toBeDefined();
      expect(Array.isArray(transitions)).toBe(true);
    }
  });

  it("Contains valid next statuses for each status", () => {
    // Created can transition to Listed
    expect(invoiceStatusTransitionMap.get("Created")).toEqual(["Listed"]);

    // Listed can transition to Funded or Defaulted
    expect(invoiceStatusTransitionMap.get("Listed")).toEqual([
      "Funded",
      "Defaulted",
    ]);

    // Funded can transition to Active, Repaid, or Defaulted
    expect(invoiceStatusTransitionMap.get("Funded")).toEqual([
      "Active",
      "Repaid",
      "Defaulted",
    ]);

    // Active can transition to Confirmed, Repaid, or Defaulted
    expect(invoiceStatusTransitionMap.get("Active")).toEqual([
      "Confirmed",
      "Repaid",
      "Defaulted",
    ]);

    // Confirmed can transition to Repaid or Defaulted
    expect(invoiceStatusTransitionMap.get("Confirmed")).toEqual([
      "Repaid",
      "Defaulted",
    ]);

    // Repaid has no transitions (terminal state)
    expect(invoiceStatusTransitionMap.get("Repaid")).toEqual([]);

    // Defaulted has no transitions (terminal state)
    expect(invoiceStatusTransitionMap.get("Defaulted")).toEqual([]);
  });
});

describe("allowedActions", () => {
  it("returns allowed actions for issuer role at each status", () => {
    // Created: issuer can viewStatus and listInvoice
    expect(allowedActions("Created", "issuer")).toEqual([
      "viewStatus",
      "listInvoice",
    ]);

    // Listed: issuer can viewStatus and cancelInvoice
    expect(allowedActions("Listed", "issuer")).toEqual([
      "viewStatus",
      "cancelInvoice",
    ]);

    // Funded: issuer can viewStatus and cancelInvoice
    expect(allowedActions("Funded", "issuer")).toEqual([
      "viewStatus",
      "cancelInvoice",
    ]);

    // Active: issuer can viewStatus and completeInvoice
    expect(allowedActions("Active", "issuer")).toEqual([
      "viewStatus",
      "completeInvoice",
    ]);

    // Confirmed: issuer can viewStatus and shipGoods
    expect(allowedActions("Confirmed", "issuer")).toEqual([
      "viewStatus",
      "shipGoods",
    ]);

    // Repaid: issuer can viewStatus and resetInvoice
    expect(allowedActions("Repaid", "issuer")).toEqual([
      "viewStatus",
      "resetInvoice",
    ]);

    // Defaulted: issuer can viewStatus and resetInvoice
    expect(allowedActions("Defaulted", "issuer")).toEqual([
      "viewStatus",
      "resetInvoice",
    ]);
  });

  it("returns allowed actions for buyer role at each status", () => {
    // Created: buyer can only viewStatus
    expect(allowedActions("Created", "buyer")).toEqual(["viewStatus"]);

    // Listed: buyer can viewStatus and fundInvoice
    expect(allowedActions("Listed", "buyer")).toEqual([
      "viewStatus",
      "fundInvoice",
    ]);

    // Funded: buyer can viewStatus and confirmReceipt
    expect(allowedActions("Funded", "buyer")).toEqual([
      "viewStatus",
      "confirmReceipt",
    ]);

    // Active: buyer can viewStatus and confirmReceipt
    expect(allowedActions("Active", "buyer")).toEqual([
      "viewStatus",
      "confirmReceipt",
    ]);

    // Confirmed: buyer can viewStatus and confirmReceipt
    expect(allowedActions("Confirmed", "buyer")).toEqual([
      "viewStatus",
      "confirmReceipt",
    ]);

    // Repaid: buyer can viewStatus only
    expect(allowedActions("Repaid", "buyer")).toEqual(["viewStatus"]);

    // Defaulted: buyer can viewStatus only
    expect(allowedActions("Defaulted", "buyer")).toEqual(["viewStatus"]);
  });

  it("returns only viewStatus for terminal states", () => {
    // Repaid terminal state: issuer has 2 actions, buyer has 1
    expect(allowedActions("Repaid", "issuer")).toHaveLength(2);
    expect(allowedActions("Repaid", "buyer")).toHaveLength(1);

    // Defaulted terminal state: issuer has 2 actions, buyer has 1
    expect(allowedActions("Defaulted", "issuer")).toHaveLength(2);
    expect(allowedActions("Defaulted", "buyer")).toHaveLength(1);
  });
});

describe("isTransitionAllowed", () => {
  it("allows valid transitions in the transition map", () => {
    // Valid transitions per the map
    expect(isTransitionAllowed("Created", "Listed", "issuer")).toBe(true);
    expect(isTransitionAllowed("Listed", "Funded", "issuer")).toBe(true);
    expect(isTransitionAllowed("Funded", "Active", "issuer")).toBe(true);
    expect(isTransitionAllowed("Active", "Confirmed", "issuer")).toBe(true);
    expect(isTransitionAllowed("Confirmed", "Repaid", "issuer")).toBe(true);

    // Buyer valid transitions
    expect(isTransitionAllowed("Listed", "Funded", "buyer")).toBe(true);
    expect(isTransitionAllowed("Funded", "Active", "buyer")).toBe(true);
    expect(isTransitionAllowed("Active", "Confirmed", "buyer")).toBe(true);
    expect(isTransitionAllowed("Confirmed", "Repaid", "buyer")).toBe(true);
  });

  it("blocks invalid transitions not in the map", () => {
    // Statuses not in the transition map from current status
    expect(isTransitionAllowed("Created", "Funded", "issuer")).toBe(false);
    expect(isTransitionAllowed("Listed", "Confirmed", "issuer")).toBe(false);
  });

  it("allows viewStatus from any status", () => {
    expect(isTransitionAllowed("Created", "viewStatus", "issuer")).toBe(true);
    expect(isTransitionAllowed("Defaulted", "viewStatus", "buyer")).toBe(true);
    expect(isTransitionAllowed("Repaid", "viewStatus", "issuer")).toBe(true);
  });

  it("blocks transitions from terminal states", () => {
    // Repaid and Defaulted are terminal states
    expect(isTransitionAllowed("Repaid", "Funded", "issuer")).toBe(false);
    expect(isTransitionAllowed("Repaid", "Active", "buyer")).toBe(false);
    expect(isTransitionAllowed("Defaulted", "Active", "buyer")).toBe(false);
    expect(isTransitionAllowed("Defaulted", "Funded", "issuer")).toBe(false);
  });
});
