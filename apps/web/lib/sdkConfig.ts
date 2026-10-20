import { configureSDK, type SDKConfig } from "@trusttrove/sdk";
import { readNetworkEnv, USDC_ISSUER } from "./env";

/**
 * Builds the SDK configuration from the web app's env (see `env.ts`).
 * Unset variables are omitted so the SDK keeps its own defaults for them.
 */
export function buildSDKConfig(): Partial<SDKConfig> {
  const env = readNetworkEnv();

  const config: Partial<SDKConfig> = {
    usdc: {
      issuer: USDC_ISSUER,
      assetCode: env.usdcAssetCode ?? "USDC",
    },
  };
  if (env.horizonUrl) config.horizonUrl = env.horizonUrl;
  if (env.sorobanRpcUrl) config.sorobanRpcUrl = env.sorobanRpcUrl;
  if (env.networkPassphrase) config.networkPassphrase = env.networkPassphrase;

  const contractIds = Object.fromEntries(
    Object.entries(env.contractIds).filter(([, id]) => Boolean(id)),
  );
  if (Object.keys(contractIds).length > 0) {
    config.contractIds = contractIds as SDKConfig["contractIds"];
  }

  return config;
}

/**
 * Wires the SDK to the web app's configuration. Safe to call repeatedly.
 *
 * Without this the SDK keeps its compiled-in testnet defaults, because its own
 * `process.env?.NEXT_PUBLIC_*` reads are not inlined by Next.js — which let
 * allowance checks (`TokenClient.forUSDC()`) target a different USDC/network
 * than the balance readers using `ASSET_INFO`.
 */
export function initSDKConfig(): void {
  configureSDK(buildSDKConfig());
}

// Single startup wiring: any module that imports the SDK through this file (or
// `app/providers.tsx`) configures it before first use.
initSDKConfig();
