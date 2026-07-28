import { describe, it, expect, vi, beforeEach } from "vitest";
import { PoolClient } from "./pool.js";

vi.mock("../base.js", () => {
  return {
    BaseContractClient: class {
      contractId: string;
      constructor(contractId: string) {
        this.contractId = contractId;
      }
      writeContract = vi.fn();
      readContract = vi.fn();
    },
  };
});

describe("PoolClient", () => {
  let client: PoolClient;

  beforeEach(() => {
    client = new PoolClient(
      "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
    );
  });

  describe("deposit", () => {
    it("calls writeContract with correct arguments", async () => {
      vi.mocked(client["writeContract"]).mockResolvedValue("mock-hash");

      const result = await client.deposit(
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
        1000n,
        "USDC",
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );

      expect(result).toBe("mock-hash");
      expect(client["writeContract"]).toHaveBeenCalledWith(
        "deposit",
        expect.any(Array),
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );
    });
  });

  describe("withdraw", () => {
    it("calls writeContract with correct arguments", async () => {
      vi.mocked(client["writeContract"]).mockResolvedValue("mock-hash");

      const result = await client.withdraw(
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
        500n,
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );

      expect(result).toBe("mock-hash");
      expect(client["writeContract"]).toHaveBeenCalledWith(
        "withdraw",
        expect.any(Array),
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );
    });
  });
});
