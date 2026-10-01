import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgentRegistryClient } from "./agentRegistry.js";

vi.mock("../base.js", () => {
  return {
    BaseContractClient: class {
      contractId: string;
      constructor(contractId: string) {
        this.contractId = contractId;
      }
      readContract = vi.fn();
    },
  };
});

describe("AgentRegistryClient", () => {
  let client: AgentRegistryClient;

  beforeEach(() => {
    client = new AgentRegistryClient(
      "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
    );
  });

  describe("getAgent", () => {
    it("calls readContract with correct arguments", async () => {
      const mockAgent = {
        agentId: "agent_underwrite",
        pubkey: "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
        active: true,
        registeredAt: 1700000000,
      };
      vi.mocked(client["readContract"]).mockResolvedValue(mockAgent);

      const result = await client.getAgent(
        "agent_underwrite",
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );

      expect(result).toEqual(mockAgent);
      expect(client["readContract"]).toHaveBeenCalledWith(
        "get_agent",
        expect.any(Array),
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
        expect.any(Function),
      );
    });

    it("propagates errors when agent is not found", async () => {
      vi.mocked(client["readContract"]).mockRejectedValue(
        new Error("Simulation failed for get_agent: AgentNotFound"),
      );

      await expect(
        client.getAgent(
          "nonexistent_agent",
          "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
        ),
      ).rejects.toThrow("AgentNotFound");
    });
  });
});
