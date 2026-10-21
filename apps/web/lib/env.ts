/**
 * Chain/network settings read from `NEXT_PUBLIC_*` env vars.
 *
 * Every read is a literal `process.env.NEXT_PUBLIC_X` member access in app
 * code, which is the only form Next.js statically inlines into the client
 * bundle. The SDK package reads the same variables with optional chaining
 * (`process.env?.X`) from a separately compiled module, which is not inlined,
 * so the web app must hand these values to the SDK itself (see `sdkConfig.ts`)
 * and use this module for anything that must agree with the SDK (e.g. the
 * USDC issuer shown in `ASSET_INFO`).
 *
 * This module has no imports so it is safe to load from any module graph.
 */

/** Testnet USDC issuer used when `NEXT_PUBLIC_USDC_ISSUER` is not set. */
export const DEFAULT_USDC_ISSUER =
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

/** Resolved USDC issuer: `NEXT_PUBLIC_USDC_ISSUER`, else the testnet default. */
export const USDC_ISSUER =
  process.env.NEXT_PUBLIC_USDC_ISSUER || DEFAULT_USDC_ISSUER;

/** Raw (possibly undefined) network settings, inlined by Next.js at build time. */
export function readNetworkEnv() {
  return {
    horizonUrl: process.env.NEXT_PUBLIC_HORIZON_URL || undefined,
    sorobanRpcUrl: process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || undefined,
    networkPassphrase: process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || undefined,
    contractIds: {
      registry: process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID || undefined,
      invoice: process.env.NEXT_PUBLIC_INVOICE_CONTRACT_ID || undefined,
      pool: process.env.NEXT_PUBLIC_POOL_CONTRACT_ID || undefined,
      escrow: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID || undefined,
      agentRegistry:
        process.env.NEXT_PUBLIC_AGENT_REGISTRY_CONTRACT_ID || undefined,
    },
    usdcAssetCode: process.env.NEXT_PUBLIC_USDC_ASSET_CODE || undefined,
  };
}
