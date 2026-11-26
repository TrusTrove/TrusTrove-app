import { describe, it, expect } from "vitest";
import { truncateAddress } from "./format";

describe("truncateAddress", () => {
  it("handles undefined or empty input", () => {
    expect(truncateAddress(undefined)).toBe("");
    expect(truncateAddress("")).toBe("");
  });

  it("returns short strings of length 10 or less unchanged", () => {
    expect(truncateAddress("GABCD")).toBe("GABCD");
    expect(truncateAddress("1234567890")).toBe("1234567890");
  });

  it("truncates strings of length 11 or more", () => {
    expect(truncateAddress("12345678901")).toBe("123456...8901");
  });

  it("truncates a full 56-character Stellar address correctly", () => {
    const addr = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASWCGXC7V2H";
    expect(truncateAddress(addr)).toBe("GBRPYH...CV2H");
  });
});
