import { describe, expect, it } from "vitest";

import { parseRawPoolStats } from "./transformers";

describe("parseRawPoolStats", () => {
  it("parses total shares from raw pool stats", () => {
    const result = parseRawPoolStats({
      total_deposits: "1000000000000",
      total_funded: "500000000000",
      available_liquidity: "500000000000",
      utilization_rate_bps: 5000,
      total_yield_distributed: "10000000000",
      active_invoice_count: 10,
      total_shares: "250000000000",
    });

    expect(result.totalShares).toEqual(BigInt("250000000000"));
  });
});
