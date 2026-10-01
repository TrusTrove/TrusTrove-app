import { useMemo } from "react";
import { AgentRegistryClient, Agent } from "@trusttrove/sdk";
import { useAsyncQuery, AsyncQueryState } from "./async.js";

export interface UseAgentRegistryOptions {
  /**
   * An already-configured AgentRegistryClient instance. When provided it is
   * used as-is, so callers control RPC/network and contract addressing without
   * depending on app-specific environment variables.
   */
  client?: AgentRegistryClient;
  /**
   * The agent-registry contract ID to construct a client for. Ignored when
   * `client` is also provided.
   */
  contractId?: string;
}

function agentRegistryClient(
  options: UseAgentRegistryOptions,
): AgentRegistryClient {
  if (options.client) return options.client;
  if (options.contractId) return new AgentRegistryClient(options.contractId);
  throw new Error(
    "useAgent: provide an injected AgentRegistryClient instance or a contractId",
  );
}

/**
 * Watches an Underwrite agent's on-chain record. Wraps
 * `AgentRegistryClient.getAgent()`.
 *
 * Useful for showing whether an agent is `active` before letting a user
 * submit or accept an attestation — the same check
 * `invoice_contract.submit_attestation` performs on-chain to verify that a
 * signer is an authorized Underwrite agent.
 *
 * @param agentId - The agent's Symbol identifier (e.g. `"agent_underwrite"`).
 * @param signerPublicKey - Public key used to simulate the read call.
 * @param options - Injected client instance or contract ID.
 */
export function useAgent(
  agentId: string,
  signerPublicKey: string,
  options: UseAgentRegistryOptions,
): AsyncQueryState<Agent> {
  const client = useMemo(() => agentRegistryClient(options), [options]);
  return useAsyncQuery(
    () => client.getAgent(agentId, signerPublicKey),
    [client, agentId, signerPublicKey],
  );
}
