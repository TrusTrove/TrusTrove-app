import { describe, it, expect, vi, beforeEach } from "vitest";
import { RegistryClient } from "./registry.js";
import { BaseContractClient } from "../base.js";

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

describe("RegistryClient", () => {
  let client: RegistryClient;

  beforeEach(() => {
    client = new RegistryClient(
      "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
    );
  });

  describe("registerIssuer", () => {
    it("calls writeContract with correct arguments", async () => {
      vi.mocked(client["writeContract"]).mockResolvedValue("mock-hash");

      const result = await client.registerIssuer(
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
        { name: "Issuer Co" },
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );

      expect(result).toBe("mock-hash");
      expect(client["writeContract"]).toHaveBeenCalledWith(
        "register_issuer",
        expect.any(Array),
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );
    });
  });

  describe("registerBuyer", () => {
    it("calls writeContract with correct arguments", async () => {
      vi.mocked(client["writeContract"]).mockResolvedValue("mock-hash");

      const result = await client.registerBuyer(
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
        { name: "Buyer Co" },
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );

      expect(result).toBe("mock-hash");
      expect(client["writeContract"]).toHaveBeenCalledWith(
        "register_buyer",
        expect.any(Array),
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );
    });
  });

  describe("isVerified", () => {
    it("calls readContract with correct arguments", async () => {
      vi.mocked(client["readContract"]).mockResolvedValue(true);

      const result = await client.isVerified(
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );

      expect(result).toBe(true);
      expect(client["readContract"]).toHaveBeenCalledWith(
        "is_verified",
        expect.any(Array),
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
        expect.any(Function),
      );
    });
  });

  describe("getProfile", () => {
    it("calls readContract with correct arguments", async () => {
      const mockProfile = {
        address: "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
        role: "issuer",
        verified: true,
        metadata: {},
      };
      vi.mocked(client["readContract"]).mockResolvedValue(mockProfile);

      const result = await client.getProfile(
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );

      expect(result).toEqual(mockProfile);
      expect(client["readContract"]).toHaveBeenCalledWith(
        "get_profile",
        expect.any(Array),
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
        expect.any(Function),
      );
    });
  });

  describe("revoke", () => {
    it("calls writeContract with correct arguments", async () => {
      vi.mocked(client["writeContract"]).mockResolvedValue("mock-hash");

      const result = await client.revoke(
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );

      expect(result).toBe("mock-hash");
      expect(client["writeContract"]).toHaveBeenCalledWith(
        "revoke",
        expect.any(Array),
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );
    });
  });
});
