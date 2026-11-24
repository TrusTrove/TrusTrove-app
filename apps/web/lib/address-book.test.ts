import { describe, it, expect, beforeEach } from "vitest";
import { getAddressBook, setAddressAlias, removeAddressAlias, resolveAddressAlias } from "./address-book";

describe("Address Book Aliases", () => {
  const wallet = "GWALLET123";
  const counterparty = "GCCOUNTERPARTY456";

  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns empty object when no aliases exist", () => {
    expect(getAddressBook(wallet)).toEqual({});
  });

  it("adds and retrieves an alias", () => {
    setAddressAlias(wallet, counterparty, "Alice Issuer");
    expect(getAddressBook(wallet)).toEqual({ [counterparty]: "Alice Issuer" });
    expect(resolveAddressAlias(wallet, counterparty)).toEqual("Alice Issuer");
  });

  it("falls back to raw address when alias is not found or wallet is missing", () => {
    expect(resolveAddressAlias(null, counterparty)).toEqual(counterparty);
    expect(resolveAddressAlias(wallet, "GUNKNOWN789")).toEqual("GUNKNOWN789");
  });

  it("edits an existing alias", () => {
    setAddressAlias(wallet, counterparty, "Alice Issuer");
    setAddressAlias(wallet, counterparty, "Alice Main");
    expect(getAddressBook(wallet)[counterparty]).toEqual("Alice Main");
  });

  it("removes an alias when set to empty or via removeAddressAlias", () => {
    setAddressAlias(wallet, counterparty, "Alice");
    removeAddressAlias(wallet, counterparty);
    expect(getAddressBook(wallet)).toEqual({});
  });
});
