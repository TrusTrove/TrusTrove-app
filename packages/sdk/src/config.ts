import { BASE_FEE, Networks, rpc } from "@stellar/stellar-sdk";

export const DEFAULT_TX_TIMEOUT_SECONDS = 30;
export const DEFAULT_TX_POLL_MAX_ATTEMPTS = 30;
export const DEFAULT_TX_POLL_INTERVAL_MS = 1000;
export const DEFAULT_RETRY_MAX_ATTEMPTS = 3;
export const DEFAULT_RETRY_BASE_DELAY_MS = 1000;
export const DEFAULT_BASE_FEE = Number(BASE_FEE);
/**
 * Upper sanity limit for `baseFee` (10,000,000 stroops = 1 XLM) to prevent
 * accidentally spending real funds due to a mistyped fee.
 */
export const MAX_BASE_FEE = 10_000_000;
export const DEFAULT_ALLOWANCE_EXPIRY_LEDGERS = 535_680;

const MAX_TX_TIMEOUT_SECONDS = 3600;
const MAX_TX_POLL_MAX_ATTEMPTS = 1000;
const MAX_TX_POLL_INTERVAL_MS = 60_000;
const MAX_RETRY_MAX_ATTEMPTS = 20;
const MAX_RETRY_BASE_DELAY_MS = 60_000;
const MAX_ALLOWANCE_EXPIRY_LEDGERS = 10_000_000;

export const DEFAULT_NETWORK = {
  network:
    (typeof process !== "undefined" &&
      process.env?.NEXT_PUBLIC_STELLAR_NETWORK) ||
    "testnet",
  horizonUrl:
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_HORIZON_URL) ||
    "https://horizon-testnet.stellar.org",
  sorobanRpcUrl:
    (typeof process !== "undefined" &&
      process.env?.NEXT_PUBLIC_SOROBAN_RPC_URL) ||
    "https://soroban-testnet.stellar.org",
  networkPassphrase:
    (typeof process !== "undefined" &&
      process.env?.NEXT_PUBLIC_NETWORK_PASSPHRASE) ||
    Networks.TESTNET,
};

export const DEFAULT_CONTRACTS = {
  registry:
    (typeof process !== "undefined" &&
      process.env?.NEXT_PUBLIC_REGISTRY_CONTRACT_ID) ||
    "",
  invoice:
    (typeof process !== "undefined" &&
      process.env?.NEXT_PUBLIC_INVOICE_CONTRACT_ID) ||
    "",
  pool:
    (typeof process !== "undefined" &&
      process.env?.NEXT_PUBLIC_POOL_CONTRACT_ID) ||
    "",
  escrow:
    (typeof process !== "undefined" &&
      process.env?.NEXT_PUBLIC_ESCROW_CONTRACT_ID) ||
    "",
  agentRegistry:
    (typeof process !== "undefined" &&
      process.env?.NEXT_PUBLIC_AGENT_REGISTRY_CONTRACT_ID) ||
    "",
};

export const DEFAULT_USDC = {
  issuer:
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_USDC_ISSUER) ||
    "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  assetCode:
    (typeof process !== "undefined" &&
      process.env?.NEXT_PUBLIC_USDC_ASSET_CODE) ||
    "USDC",
};

export interface SDKConfig {
  horizonUrl: string;
  sorobanRpcUrl: string;
  networkPassphrase: string;
  contractIds: {
    registry: string;
    invoice: string;
    pool: string;
    escrow: string;
    agentRegistry: string;
  };
  usdc: {
    issuer: string;
    assetCode: string;
  };
  /**
   * Transaction validity window in seconds (integer `1..3600`, default `30`).
   * If longer than `txPollMaxAttempts * txPollIntervalMs`, a transaction can
   * still land on-chain after `TransactionTimeoutError` is thrown. Polling
   * longer than `txTimeoutSeconds` is pointless since the transaction expires.
   */
  txTimeoutSeconds?: number;
  /** Maximum `getTransaction` poll attempts after submission (integer `1..1000`, default `30`). */
  txPollMaxAttempts?: number;
  /** Interval in ms between `getTransaction` poll attempts (integer `1..60000`, default `1000`). */
  txPollIntervalMs?: number;
  /** Maximum attempts for retryable RPC calls (integer `1..20`, default `3`). */
  retryMaxAttempts?: number;
  /** Base backoff delay in ms for retryable RPC calls (integer `1..60000`, default `1000`). */
  retryBaseDelayMs?: number;
  /**
   * Base inclusion fee per operation in stroops (integer `100..10000000`, default `100`).
   * Capped at `MAX_BASE_FEE` (1 XLM) to guard against mistyped fees.
   */
  baseFee?: number;
  /**
   * Ledger offset from the latest ledger for token `approve` expiry (integer `1..10000000`, default `535680`).
   * Must not exceed the network's maximum entry TTL.
   */
  allowanceExpiryLedgers?: number;
}

let activeConfig: SDKConfig = {
  horizonUrl: DEFAULT_NETWORK.horizonUrl,
  sorobanRpcUrl: DEFAULT_NETWORK.sorobanRpcUrl,
  networkPassphrase: DEFAULT_NETWORK.networkPassphrase,
  contractIds: {
    registry: DEFAULT_CONTRACTS.registry,
    invoice: DEFAULT_CONTRACTS.invoice,
    pool: DEFAULT_CONTRACTS.pool,
    escrow: DEFAULT_CONTRACTS.escrow,
    agentRegistry: DEFAULT_CONTRACTS.agentRegistry,
  },
  usdc: {
    issuer: DEFAULT_USDC.issuer,
    assetCode: DEFAULT_USDC.assetCode,
  },
  txTimeoutSeconds: DEFAULT_TX_TIMEOUT_SECONDS,
  txPollMaxAttempts: DEFAULT_TX_POLL_MAX_ATTEMPTS,
  txPollIntervalMs: DEFAULT_TX_POLL_INTERVAL_MS,
  retryMaxAttempts: DEFAULT_RETRY_MAX_ATTEMPTS,
  retryBaseDelayMs: DEFAULT_RETRY_BASE_DELAY_MS,
  baseFee: DEFAULT_BASE_FEE,
  allowanceExpiryLedgers: DEFAULT_ALLOWANCE_EXPIRY_LEDGERS,
};

function validateIntRange(
  name: string,
  value: number | undefined,
  min: number,
  max: number,
): void {
  if (value === undefined) return;
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(
      `Invalid SDKConfig.${name}: expected an integer between ${min} and ${max}, got ${value}`,
    );
  }
}

export function configureSDK(config: Partial<SDKConfig>) {
  validateIntRange(
    "txTimeoutSeconds",
    config.txTimeoutSeconds,
    1,
    MAX_TX_TIMEOUT_SECONDS,
  );
  validateIntRange(
    "txPollMaxAttempts",
    config.txPollMaxAttempts,
    1,
    MAX_TX_POLL_MAX_ATTEMPTS,
  );
  validateIntRange(
    "txPollIntervalMs",
    config.txPollIntervalMs,
    1,
    MAX_TX_POLL_INTERVAL_MS,
  );
  validateIntRange(
    "retryMaxAttempts",
    config.retryMaxAttempts,
    1,
    MAX_RETRY_MAX_ATTEMPTS,
  );
  validateIntRange(
    "retryBaseDelayMs",
    config.retryBaseDelayMs,
    1,
    MAX_RETRY_BASE_DELAY_MS,
  );
  validateIntRange("baseFee", config.baseFee, DEFAULT_BASE_FEE, MAX_BASE_FEE);
  validateIntRange(
    "allowanceExpiryLedgers",
    config.allowanceExpiryLedgers,
    1,
    MAX_ALLOWANCE_EXPIRY_LEDGERS,
  );

  activeConfig = {
    ...activeConfig,
    ...config,
    contractIds: {
      ...activeConfig.contractIds,
      ...config.contractIds,
    },
    usdc: {
      ...activeConfig.usdc,
      ...config.usdc,
    },
  };
}

export function getConfig(): SDKConfig {
  // A copy, not `activeConfig` itself: callers that write to a nested field
  // (`contractIds.pool`, `usdc.issuer`) would otherwise silently repoint every
  // later contract call, bypassing configureSDK's merge semantics.
  return {
    ...activeConfig,
    contractIds: { ...activeConfig.contractIds },
    usdc: { ...activeConfig.usdc },
  };
}

export function getSorobanServer(): rpc.Server {
  return new rpc.Server(activeConfig.sorobanRpcUrl);
}
