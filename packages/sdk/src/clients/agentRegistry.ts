import { nativeToScVal, scValToNative } from "@stellar/stellar-sdk";
import { BaseContractClient } from "../base.js";
import { Agent } from "../types/index.js";
import { parseAgent } from "../types/schemas.js";

/**
 * Client for Underwrite's agent-registry contract.
 *
 * This is a **separate, external** contract (deployed from the
 * `underwrite-contract` repo) — not the same as TrusTrove's own
 * issuer/buyer registry (`RegistryClient`). The agent-registry is what
 * `invoice_contract.submit_attestation` checks against on-chain to
 * verify that a signer is an authorized Underwrite agent.
 *
 * @example
 * ```ts
 * const client = new AgentRegistryClient(agentRegistryContractId);
 * const agent = await client.getAgent("agent_underwrite", signerPublicKey);
 * console.log(agent.active); // true
 * ```
 */
export class AgentRegistryClient extends BaseContractClient {
  /**
   * Retrieves an agent's on-chain record from the agent-registry contract.
   * This is a read-only (simulated) call — no on-chain side effects.
   *
   * @param agentId - The agent's Symbol identifier (e.g. `"agent_underwrite"`).
   * @param signerPublicKey - The Stellar public key used to simulate the read call.
   * @returns The parsed {@link Agent} object containing `agentId`, `pubkey`, `active` status, and `registeredAt` timestamp.
   * @throws If the agent is not found, the simulation fails, or the return value cannot be parsed.
   */
  async getAgent(agentId: string, signerPublicKey: string): Promise<Agent> {
    const args = [nativeToScVal(agentId, { type: "symbol" })];
    return this.readContract("get_agent", args, signerPublicKey, (val) =>
      parseAgent(scValToNative(val)),
    );
  }
}
