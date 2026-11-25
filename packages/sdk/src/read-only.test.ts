import { describe, expect, it, expectTypeOf } from "vitest";
import { getConfig } from "./config.js";
import {
  createReadOnlyClient,
  type ReadOnlyClients,
  type ReadOnlyPoolClient,
} from "./read-only.js";

const CONTRACT_IDS = {
  registry: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
  invoice: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
  pool: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
  escrow: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
  agentRegistry: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
};

function config(overrides: Record<string, unknown> = {}): any {
  return {
    network: "testnet" as const,
    rpcUrl: "https://soroban-testnet.stellar.org",
    contractIds: CONTRACT_IDS,
    ...overrides,
  };
}

describe("createReadOnlyClient", () => {
  it("builds every read-only client from explicit network configuration", () => {
    const readers = createReadOnlyClient(config());

    expect(typeof readers.registry.isVerified).toBe("function");
    expect(typeof readers.invoice.getByStatus).toBe("function");
    expect(typeof readers.pool.getStats).toBe("function");
    expect(typeof readers.pool.getLPPosition).toBe("function");
    expect(typeof readers.escrow.getLocked).toBe("function");
    expect(typeof readers.token.allowance).toBe("function");
    expect(typeof readers.agentRegistry.getAgent).toBe("function");
  });

  it("exposes no write methods at runtime", () => {
    const { pool, invoice, registry, escrow } = createReadOnlyClient(config());

    for (const method of ["deposit", "withdraw", "fundInvoice"]) {
      expect(method in pool).toBe(false);
    }
    for (const method of ["create", "repay", "listForFinancing"]) {
      expect(method in invoice).toBe(false);
    }
    expect("registerIssuer" in registry).toBe(false);
    expect("lock" in escrow).toBe(false);
  });

  it("exposes no write methods at the type level", () => {
    expectTypeOf<keyof ReadOnlyPoolClient>().toEqualTypeOf<
      "getStats" | "getLPPosition" | "getUtilizationRate"
    >();
    // @ts-expect-error deposit is not part of the read-only client type.
    expectTypeOf<ReadOnlyClients["pool"]>().not.toHaveProperty("deposit");
  });

  it("does not mutate the process-wide SDK configuration", () => {
    const before = getConfig();

    createReadOnlyClient(
      config({ network: "mainnet", rpcUrl: "https://example.com/rpc" }),
    );

    expect(getConfig()).toEqual(before);
  });

  it("does not require a contract ID for an unused client", () => {
    const readers = createReadOnlyClient({
      network: "testnet",
      rpcUrl: "https://soroban-testnet.stellar.org",
      contractIds: { pool: CONTRACT_IDS.pool },
    });

    expect(typeof readers.pool.getStats).toBe("function");
    expect(() => readers.invoice).toThrow(/invoice contract ID is required/);
  });

  it("rejects an unknown network", () => {
    expect(() =>
      createReadOnlyClient(config({ network: "futurenet" })),
    ).toThrow(/Unknown network "futurenet"/);
  });

  it("rejects a missing or non-http RPC URL", () => {
    expect(() => createReadOnlyClient(config({ rpcUrl: "  " }))).toThrow(
      /RPC URL is required/,
    );
    expect(() => createReadOnlyClient(config({ rpcUrl: "ftp://example.com" }))).toThrow(
      /Expected an http\(s\) URL/,
    );
  });

  it("requires a passphrase for a custom network", () => {
    expect(() => createReadOnlyClient(config({ network: "custom" }))).toThrow(
      /networkPassphrase is required/,
    );

    const readers = createReadOnlyClient(
      config({
        network: "custom",
        rpcUrl: "https://rpc.example.com",
        networkPassphrase: "Custom Network ; 2026",
      }),
    );
    expect(typeof readers.pool.getStats).toBe("function");
  });
});
