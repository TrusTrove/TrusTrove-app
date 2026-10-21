import { describe, it, expect, vi, beforeEach } from "vitest";
import { Address, xdr } from "@stellar/stellar-sdk";
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

  describe("handleDefault", () => {
    it("calls writeContract with handle_default and resolves true", async () => {
      vi.mocked(client["writeContract"]).mockResolvedValue("mock-hash");

      const result = await client.handleDefault(
        "abcd",
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );

      expect(result).toBe(true);
      expect(client["writeContract"]).toHaveBeenCalledWith(
        "handle_default",
        expect.any(Array),
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );
    });

    it("encodes the invoice id as a bytes argument", async () => {
      vi.mocked(client["writeContract"]).mockResolvedValue("mock-hash");

      await client.handleDefault(
        "abcd",
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );

      const args = vi.mocked(client["writeContract"]).mock
        .calls[0][1] as xdr.ScVal[];

      expect(args).toEqual([xdr.ScVal.scvBytes(Buffer.from("abcd", "hex"))]);
    });
  });

  describe("initialize", () => {
    it("calls writeContract with correct arguments", async () => {
      vi.mocked(client["writeContract"]).mockResolvedValue("mock-hash");

      const adminAddress =
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB";
      const signerPublicKey =
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB";

      const result = await client.initialize(adminAddress, signerPublicKey);

      expect(result).toBe("mock-hash");
      expect(client["writeContract"]).toHaveBeenCalledWith(
        "initialize",
        [new Address(adminAddress).toScVal()],
        signerPublicKey,
      );
    });
  });

  describe("deposit", () => {
    it("calls writeContract with correct arguments", async () => {
      vi.mocked(client["writeContract"]).mockResolvedValue("mock-hash");

      const result = await client.deposit(
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
        1000n,
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

  describe("fundInvoice", () => {
    it("calls writeContract with correct arguments", async () => {
      vi.mocked(client["writeContract"]).mockResolvedValue("mock-hash");

      const result = await client.fundInvoice(
        "abcd",
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );

      expect(result).toBe(true);
      expect(client["writeContract"]).toHaveBeenCalledWith(
        "fund_invoice",
        expect.any(Array),
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );
    });
  });

  describe("receiveRepayment", () => {
    it("calls writeContract with correct arguments", async () => {
      vi.mocked(client["writeContract"]).mockResolvedValue("mock-hash");

      const result = await client.receiveRepayment(
        "abcd",
        1000n,
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );

      expect(result).toBe(true);
      expect(client["writeContract"]).toHaveBeenCalledWith(
        "receive_repayment",
        expect.any(Array),
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );
    });
  });

  describe("getStats", () => {
    it("calls readContract with correct arguments", async () => {
      const mockStats = { totalValueLocked: 1000n };
      vi.mocked(client["readContract"]).mockResolvedValue(mockStats);

      const result = await client.getStats(
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );

      expect(result).toEqual(mockStats);
      expect(client["readContract"]).toHaveBeenCalledWith(
        "get_stats",
        expect.any(Array),
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
        expect.any(Function),
      );
    });
  });

  describe("getLPPosition", () => {
    it("calls readContract with correct arguments", async () => {
      const mockPosition = { shares: 500n };
      vi.mocked(client["readContract"]).mockResolvedValue(mockPosition);

      const result = await client.getLPPosition(
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );

      expect(result).toEqual(mockPosition);
      expect(client["readContract"]).toHaveBeenCalledWith(
        "get_lp_position",
        expect.any(Array),
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
        expect.any(Function),
      );
    });
  });

  describe("getUtilizationRate", () => {
    it("calls readContract with correct arguments", async () => {
      vi.mocked(client["readContract"]).mockResolvedValue(50);

      const result = await client.getUtilizationRate(
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );

      expect(result).toBe(50);
      expect(client["readContract"]).toHaveBeenCalledWith(
        "get_utilization_rate",
        expect.any(Array),
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
        expect.any(Function),
      );
    });

    it("passes the contract's basis-point scalar through unchanged", async () => {
      // readContract is mocked, so this drives the wrapper's own parse closure
      // with the ScVal a real simulation returns.
      vi.mocked(client["readContract"]).mockImplementation(
        async (_method, _args, _publicKey, parse) =>
          parse(xdr.ScVal.scvU32(5000)),
      );

      const result = await client.getUtilizationRate(
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );

      expect(
        result,
        "5000 basis points (50%) must not be rescaled into a 0-1 decimal",
      ).toBe(5000);
    });

    it("returns 0 for an empty pool rather than null or NaN", async () => {
      vi.mocked(client["readContract"]).mockImplementation(
        async (_method, _args, _publicKey, parse) => parse(xdr.ScVal.scvU32(0)),
      );

      const result = await client.getUtilizationRate(
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );

      expect(result).toBe(0);
    });
  });
});
