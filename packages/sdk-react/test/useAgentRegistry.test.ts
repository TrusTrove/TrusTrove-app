import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { AgentRegistryClient } from "@trusttrove/sdk";
import { useAgent, UseAgentRegistryOptions } from "../src/useAgentRegistry.js";

vi.mock("@trusttrove/sdk", () => {
  class MockAgentRegistryClient {
    contractId: string;
    constructor(contractId: string) {
      this.contractId = contractId;
    }
    getAgent = vi.fn();
  }
  return { AgentRegistryClient: MockAgentRegistryClient };
});

const AGENT_ID = "agent_underwrite";
const SIGNER = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const CONTRACT_ID = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";

function makeOptions(
  client?: Partial<AgentRegistryClient>,
): UseAgentRegistryOptions {
  return { client: (client ?? {}) as AgentRegistryClient };
}

describe("useAgentRegistry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useAgent", () => {
    it("returns the agent with loading/error/data state", async () => {
      const agent = {
        agentId: AGENT_ID,
        pubkey: SIGNER,
        active: true,
        registeredAt: 1234,
      } as const;
      const client = new AgentRegistryClient(CONTRACT_ID);
      vi.mocked(client.getAgent).mockResolvedValue(agent as any);

      const { result } = renderHook(() =>
        useAgent(AGENT_ID, SIGNER, makeOptions(client)),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(agent);
      expect(result.current.error).toBeNull();
      expect(client.getAgent).toHaveBeenCalledWith(AGENT_ID, SIGNER);
    });

    it("surfaces read errors", async () => {
      const client = new AgentRegistryClient(CONTRACT_ID);
      vi.mocked(client.getAgent).mockRejectedValue(
        new Error("agent not found"),
      );

      const { result } = renderHook(() =>
        useAgent(AGENT_ID, SIGNER, makeOptions(client)),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeNull();
      expect(result.current.error).toEqual(new Error("agent not found"));
    });

    it("refetches when the agent id changes", async () => {
      const client = new AgentRegistryClient(CONTRACT_ID);
      vi.mocked(client.getAgent).mockResolvedValue({
        agentId: AGENT_ID,
        pubkey: SIGNER,
        active: true,
        registeredAt: 1234,
      } as any);

      const { result, rerender } = renderHook(
        ({ agentId }) => useAgent(agentId, SIGNER, makeOptions(client)),
        { initialProps: { agentId: AGENT_ID } },
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(client.getAgent).toHaveBeenNthCalledWith(1, AGENT_ID, SIGNER);

      rerender({ agentId: "agent_other" });
      await waitFor(() => expect(client.getAgent).toHaveBeenCalledTimes(2));
      expect(client.getAgent).toHaveBeenNthCalledWith(2, "agent_other", SIGNER);
    });
  });
});
