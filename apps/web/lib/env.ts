export const DEFAULT_USDC_ISSUER = Object.freeze(
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
);

export const SOROBAN_RPC_URL = Object.freeze(
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org"
);

export const NETWORK_PASSPHRASE = Object.freeze(
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || "Test SDF Network ; September 2015"
);

export function readNetworkEnv() {
  return Object.freeze({
    horizonUrl: process.env.NEXT_PUBLIC_HORIZON_URL || undefined,
    sorobanRpcUrl: process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || undefined,
    networkPassphrase: process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || undefined,
    contractIds: Object.freeze({
      registry: process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID || undefined,
      invoice: process.env.NEXT_PUBLIC_INVOICE_CONTRACT_ID || undefined,
      pool: process.env.NEXT_PUBLIC_POOL_CONTRACT_ID || undefined,
      escrow: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID || undefined,
      agentRegistry:
        process.env.NEXT_PUBLIC_AGENT_REGISTRY_CONTRACT_ID || undefined,
    }),
    usdcAssetCode: process.env.NEXT_PUBLIC_USDC_ASSET_CODE || undefined,
  });
}

export interface ContractIdsConfig {
  readonly registry: string;
  readonly invoice: string;
  readonly pool: string;
  readonly escrow: string;
  readonly token: string;
  readonly agentRegistry: string;
}

export interface AppConfig {
  readonly HORIZON_URL: string;
  readonly API_BASE_URL: string;
  readonly APP_URL: string;
  readonly USDC_ISSUER: string;
  readonly CONTRACT_IDS: ContractIdsConfig;
}

export const HORIZON_URL: string = Object.freeze(
  process.env.NEXT_PUBLIC_HORIZON_URL || "https://horizon-testnet.stellar.org"
);

export const API_BASE_URL: string = Object.freeze(
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080"
);

export const APP_URL: string = Object.freeze(
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
);

export const USDC_ISSUER: string = Object.freeze(
  process.env.NEXT_PUBLIC_USDC_ISSUER || "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
);

if (process.env.NODE_ENV === "production") {
  if (!process.env.NEXT_PUBLIC_API_BASE_URL) {
    console.warn("WARNING: NEXT_PUBLIC_API_BASE_URL is not set in production.");
  }
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    console.warn("WARNING: NEXT_PUBLIC_APP_URL is not set in production.");
  }
}

export const CONTRACT_IDS: ContractIdsConfig = Object.freeze({
  registry: process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID || "",
  invoice: process.env.NEXT_PUBLIC_INVOICE_CONTRACT_ID || "",
  pool: process.env.NEXT_PUBLIC_POOL_CONTRACT_ID || "",
  escrow: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID || "",
  token: process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ID || "",
  agentRegistry: process.env.NEXT_PUBLIC_AGENT_REGISTRY_CONTRACT_ID || "",
});

export const env: AppConfig = Object.freeze({
  HORIZON_URL,
  API_BASE_URL,
  APP_URL,
  USDC_ISSUER,
  CONTRACT_IDS,
});
