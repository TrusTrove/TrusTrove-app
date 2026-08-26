import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  Asset,
  Networks,
  nativeToScVal,
  scValToNative,
} from "@stellar/stellar-sdk";
import { TokenClient } from "./token.js";
import { getConfig } from "../config.js";

vi.mock("../base.js", () => ({
  BaseContractClient: class {
    contractId: string;
    constructor(contractId: string) {
      this.contractId = contractId;
    }
    writeContract = vi.fn();
    readContract = vi.fn();
  },
}));

vi.mock("../config.js", () => ({
  getConfig: vi.fn(),
}));

const owner = "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB";
const spender = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const signer = "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB";
const usdcIssuer = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

describe("TokenClient", () => {
  let client: TokenClient;

  beforeEach(() => {
    vi.mocked(getConfig).mockReturnValue({
      horizonUrl: "https://horizon-testnet.stellar.org",
      sorobanRpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: Networks.TESTNET,
      contractIds: { registry: "", invoice: "", pool: "", escrow: "" },
      usdc: { assetCode: "USDC", issuer: usdcIssuer },
    });
    client = new TokenClient(
      "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
    );
  });

  describe("forUSDC", () => {
    it("derives the SAC contract ID from the configured asset", () => {
      const usdcClient = TokenClient.forUSDC();
      const expectedContractId = new Asset("USDC", usdcIssuer).contractId(
        Networks.TESTNET,
      );

      expect(usdcClient["contractId"]).toBe(expectedContractId);
    });
  });

  describe("allowance", () => {
    it("encodes addresses and parses the returned allowance", async () => {
      vi.mocked(client["readContract"]).mockImplementation(
        async (_method, args, _publicKey, parse) =>
          parse(nativeToScVal(1250000n, { type: "i128" })),
      );

      const result = await client.allowance(owner, spender, signer);

      expect(result).toBe(1250000n);
      const [method, args, publicKey] = vi.mocked(client["readContract"]).mock
        .calls[0];
      expect(method).toBe("allowance");
      expect(args).toHaveLength(2);
      expect(scValToNative(args[0])).toBe(owner);
      expect(scValToNative(args[1])).toBe(spender);
      expect(publicKey).toBe(signer);
    });

    it("propagates simulation failures", async () => {
      vi.mocked(client["readContract"]).mockRejectedValue(
        new Error("Simulation failed for allowance: insufficient balance"),
      );

      await expect(client.allowance(owner, spender, signer)).rejects.toThrow(
        "Simulation failed for allowance: insufficient balance",
      );
    });
  });

  describe("approve", () => {
    it("encodes addresses, amount, and expiration ledger", async () => {
      vi.mocked(client["writeContract"]).mockResolvedValue("mock-hash");

      const result = await client.approve(
        owner,
        spender,
        987654321n,
        456789,
        signer,
      );

      expect(result).toBe("mock-hash");
      const [method, args, publicKey] = vi.mocked(client["writeContract"]).mock
        .calls[0];
      expect(method).toBe("approve");
      expect(args).toHaveLength(4);
      expect(scValToNative(args[0])).toBe(owner);
      expect(scValToNative(args[1])).toBe(spender);
      expect(scValToNative(args[2])).toBe(987654321n);
      expect(scValToNative(args[3])).toBe(456789);
      expect(publicKey).toBe(signer);
    });
  });
});
