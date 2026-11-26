import { Asset, Networks } from "@stellar/stellar-sdk";
import { getConfig, type SDKConfig } from "./config.js";
import type { ContractClientNetworkConfig } from "./base.js";
import { AgentRegistryClient } from "./clients/agentRegistry.js";
import { EscrowClient } from "./clients/escrow.js";
import { InvoiceClient } from "./clients/invoice.js";
import { PoolClient } from "./clients/pool.js";
import { RegistryClient } from "./clients/registry.js";
import { TokenClient } from "./clients/token.js";

/** Networks the read-only factory can bind to. */
export const READ_ONLY_NETWORKS = ["testnet", "mainnet", "custom"] as const;
export type ReadOnlyNetwork = (typeof READ_ONLY_NETWORKS)[number];

/**
 * Explicit network and RPC configuration for a read-only client set.
 *
 * `network` and `rpcUrl` are required: a reader must never silently inherit
 * whichever network the process happens to be configured for. `custom` is
 * accepted for non-preset networks and then requires `networkPassphrase`.
 */
export interface ReadOnlyClientConfig {
  /** `testnet`, `mainnet`, or `custom`. */
  network: ReadOnlyNetwork;
  /** Soroban RPC endpoint to read from. Must be an http(s) URL. */
  rpcUrl: string;
  /** Network passphrase. Required when `network` is `custom`. */
  networkPassphrase?: string;
  /**
   * Contract IDs to bind. Any ID left out falls back to the active SDK
   * configuration. A client is only constructed when its property is first
   * read, so an unused contract never needs an ID.
   */
  contractIds?: Partial<SDKConfig["contractIds"]>;
  /** USDC asset details used to derive the token contract ID. */
  usdc?: Partial<SDKConfig["usdc"]>;
}

/** Invoice reads exposed by the read-only factory. */
export type ReadOnlyInvoiceClient = Pick<
  InvoiceClient,
  "get" | "getByStatus" | "getByIssuer" | "getByBuyer"
>;

/** Pool reads exposed by the read-only factory. */
export type ReadOnlyPoolClient = Pick<
  PoolClient,
  "getStats" | "getLPPosition" | "getUtilizationRate"
>;

/** Registry reads exposed by the read-only factory. */
export type ReadOnlyRegistryClient = Pick<
  RegistryClient,
  "isVerified" | "getProfile"
>;

/** Escrow reads exposed by the read-only factory. */
export type ReadOnlyEscrowClient = Pick<EscrowClient, "getLocked">;

/** Token reads exposed by the read-only factory. */
export type ReadOnlyTokenClient = Pick<TokenClient, "allowance">;

/** Agent-registry reads exposed by the read-only factory. */
export type ReadOnlyAgentRegistryClient = Pick<AgentRegistryClient, "getAgent">;

/**
 * Contract clients that can read but cannot write. Every method that submits a
 * signed transaction is absent from these types.
 */
export interface ReadOnlyClients {
  readonly registry: ReadOnlyRegistryClient;
  readonly invoice: ReadOnlyInvoiceClient;
  readonly pool: ReadOnlyPoolClient;
  readonly escrow: ReadOnlyEscrowClient;
  readonly token: ReadOnlyTokenClient;
  readonly agentRegistry: ReadOnlyAgentRegistryClient;
}

function parseNetwork(
  config: ReadOnlyClientConfig,
): ContractClientNetworkConfig {
  const network = (config.network ?? "").trim().toLowerCase();
  if (!READ_ONLY_NETWORKS.includes(network as ReadOnlyNetwork)) {
    throw new Error(
      `Unknown network "${String(config.network)}". Expected one of: ${READ_ONLY_NETWORKS.join(", ")}.`,
    );
  }

  const rpcUrl = (config.rpcUrl ?? "").trim();
  if (!rpcUrl) {
    throw new Error(
      "A Soroban RPC URL is required. Pass rpcUrl in the read-only factory configuration.",
    );
  }
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rpcUrl);
  } catch {
    throw new Error(`Invalid RPC URL "${rpcUrl}". Expected an http(s) URL.`);
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error(`Invalid RPC URL "${rpcUrl}". Expected an http(s) URL.`);
  }

  let networkPassphrase: string;
  if (network === "custom") {
    const passphrase = (config.networkPassphrase ?? "").trim();
    if (!passphrase) {
      throw new Error(
        'A networkPassphrase is required when network is "custom".',
      );
    }
    networkPassphrase = passphrase;
  } else {
    networkPassphrase =
      config.networkPassphrase?.trim() ||
      (network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET);
  }

  return { sorobanRpcUrl: rpcUrl, networkPassphrase };
}

/**
 * Copies only the named methods onto a frozen object, binding each to the
 * underlying client. The returned value has no write methods at runtime and
 * cannot be used to reach the original instance.
 */
function readOnlyView<T extends object, K extends keyof T>(
  client: T,
  methods: readonly K[],
): Pick<T, K> {
  const view = {} as Record<PropertyKey, unknown>;
  for (const method of methods) {
    const value = client[method];
    if (typeof value !== "function") {
      throw new Error(
        `Read-only client is missing the ${String(method)} method.`,
      );
    }
    view[method as PropertyKey] = value.bind(client);
  }
  return Object.freeze(view) as Pick<T, K>;
}

/**
 * Creates a set of contract clients that can only read, bound to an explicit
 * network and Soroban RPC endpoint.
 *
 * Unlike {@link configureSDK}, this does not mutate process-wide state: each
 * client carries its own network configuration, so several read-only sets can
 * coexist and a concurrent `configureSDK` call cannot repoint them.
 *
 * @example
 * ```ts
 * const readers = createReadOnlyClient({
 *   network: "testnet",
 *   rpcUrl: "https://soroban-testnet.stellar.org",
 *   contractIds: { pool: process.env.POOL_CONTRACT_ID! },
 * });
 *
 * const stats = await readers.pool.getStats(publicKey);
 * // readers.pool.deposit(...) does not exist.
 * ```
 *
 * @throws {Error} When the network, RPC URL, passphrase, or a contract ID is
 *   invalid or missing.
 */
export function createReadOnlyClient(
  config: ReadOnlyClientConfig,
): ReadOnlyClients {
  if (!config || typeof config !== "object") {
    throw new Error("Read-only client configuration is required.");
  }
  const networkConfig = parseNetwork(config);
  const clients = new Map<keyof ReadOnlyClients, unknown>();

  const cached = <T>(key: keyof ReadOnlyClients, create: () => T): T => {
    if (!clients.has(key)) clients.set(key, create());
    return clients.get(key) as T;
  };

  const contractId = (name: keyof SDKConfig["contractIds"]): string => {
    const id = (
      config.contractIds?.[name] ??
      getConfig().contractIds[name] ??
      ""
    ).trim();
    if (!id) {
      throw new Error(
        `A ${name} contract ID is required. Pass contractIds.${name} to the read-only factory.`,
      );
    }
    return id;
  };

  return {
    get registry() {
      return cached("registry", () =>
        readOnlyView(
          new RegistryClient(contractId("registry"), {}, networkConfig),
          ["isVerified", "getProfile"] as const,
        ),
      );
    },
    get invoice() {
      return cached("invoice", () =>
        readOnlyView(
          new InvoiceClient(contractId("invoice"), {}, networkConfig),
          ["get", "getByStatus", "getByIssuer", "getByBuyer"] as const,
        ),
      );
    },
    get pool() {
      return cached("pool", () =>
        readOnlyView(new PoolClient(contractId("pool"), {}, networkConfig), [
          "getStats",
          "getLPPosition",
          "getUtilizationRate",
        ] as const),
      );
    },
    get escrow() {
      return cached("escrow", () =>
        readOnlyView(
          new EscrowClient(contractId("escrow"), {}, networkConfig),
          ["getLocked"] as const,
        ),
      );
    },
    get token() {
      return cached("token", () => {
        const usdc = {
          ...getConfig().usdc,
          ...config.usdc,
        };
        const asset = new Asset(usdc.assetCode, usdc.issuer);
        const sacContractId = asset.contractId(networkConfig.networkPassphrase);
        return readOnlyView(new TokenClient(sacContractId, {}, networkConfig), [
          "allowance",
        ] as const);
      });
    },
    get agentRegistry() {
      return cached("agentRegistry", () =>
        readOnlyView(
          new AgentRegistryClient(
            contractId("agentRegistry"),
            {},
            networkConfig,
          ),
          ["getAgent"] as const,
        ),
      );
    },
  };
}
