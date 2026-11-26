import { describe, it, expect } from "vitest";
import { truncateAddress } from "./format";

describe("truncateAddress", () => {
  it("returns empty string for empty input", () => {
    expect(truncateAddress("")).toBe("");
  });

  it("returns short strings of length 10 or less unchanged", () => {
    expect(truncateAddress("GABCD")).toBe("GABCD");
    expect(truncateAddress("1234567890")).toBe("1234567890");
  });

  it("returns short strings of length 1 unchanged", () => {
    expect(truncateAddress("G")).toBe("G");
  });

  it("truncates strings of length 11 or more, including 56-character Stellar addresses", () => {
    const stellarAddr = "GABCD1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDE";
    const truncated = truncateAddress(stellarAddr);
    expect(truncated).toBe("GABCD1...BCDE");
    expect(stellarAddr.length).toBe(56);
  });
});
