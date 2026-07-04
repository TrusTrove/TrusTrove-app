import { describe, it, expect } from "vitest";
import { StrKey } from "@stellar/stellar-sdk";

describe("Regression: Buyer address StrKey checksum validation (issue #130)", () => {
  it("accepts a valid Stellar Ed25519 public key", () => {
    const validKey =
      "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
    const result = StrKey.isValidEd25519PublicKey(validKey);
    expect(result).toBe(true);
  });

  it("rejects a string that is 56 chars but not a valid checksum", () => {
    const fakeKey = "G12345678901234567890123456789012345678901234567890123456";
    const result = StrKey.isValidEd25519PublicKey(fakeKey);
    expect(result).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(StrKey.isValidEd25519PublicKey("")).toBe(false);
  });

  it("rejects a string that is too short", () => {
    expect(StrKey.isValidEd25519PublicKey("Gshort")).toBe(false);
  });

  it("rejects a string that does not start with G", () => {
    const result = StrKey.isValidEd25519PublicKey(
      "AXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    );
    expect(result).toBe(false);
  });

  it("rejects garbage input", () => {
    expect(StrKey.isValidEd25519PublicKey("not-a-key!!!")).toBe(false);
  });

  it("rejects whitespace-padded valid key (validation handles trim separately)", () => {
    const validKey =
      "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
    expect(StrKey.isValidEd25519PublicKey(`  ${validKey}  `)).toBe(false);
  });
});
