import { StrKey } from "@stellar/stellar-sdk";

export const REQUIRED_ENV_VARS = [
  "NEXT_PUBLIC_STELLAR_NETWORK",
  "NEXT_PUBLIC_HORIZON_URL",
  "NEXT_PUBLIC_SOROBAN_RPC_URL",
  "NEXT_PUBLIC_NETWORK_PASSPHRASE",
  "NEXT_PUBLIC_REGISTRY_CONTRACT_ID",
  "NEXT_PUBLIC_INVOICE_CONTRACT_ID",
  "NEXT_PUBLIC_POOL_CONTRACT_ID",
  "NEXT_PUBLIC_ESCROW_CONTRACT_ID",
  "NEXT_PUBLIC_USDC_ISSUER",
  "NEXT_PUBLIC_USDC_ASSET_CODE",
] as const;
/**
 * Result of validating the required environment variables and their network consistency/format.
 *
 * @property missing - Names of required env vars that are absent or empty.
 * @property invalid - Names of env vars that have invalid formats or network inconsistencies.
 * @property isConfigured - `true` when every required env var is present and valid.
 */
export interface ConfigValidation {
  missing: string[];
  invalid: string[];
  isConfigured: boolean;
}

let cachedValidation: ConfigValidation | null = null;

/**
 * Validates that all required environment variables are set and formatted correctly,
 * and checks network consistency between NEXT_PUBLIC_STELLAR_NETWORK and passphrase/URLs.
 */
export function validateConfig(): ConfigValidation {
  if (cachedValidation) return cachedValidation;

  // Next.js only inlines public variables referenced by name in client bundles.
  const requiredEnv: Record<string, string | undefined> = {
    NEXT_PUBLIC_STELLAR_NETWORK: process.env.NEXT_PUBLIC_STELLAR_NETWORK,
    NEXT_PUBLIC_HORIZON_URL: process.env.NEXT_PUBLIC_HORIZON_URL,
    NEXT_PUBLIC_SOROBAN_RPC_URL: process.env.NEXT_PUBLIC_SOROBAN_RPC_URL,
    NEXT_PUBLIC_NETWORK_PASSPHRASE: process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE,
    NEXT_PUBLIC_REGISTRY_CONTRACT_ID:
      process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID,
    NEXT_PUBLIC_INVOICE_CONTRACT_ID:
      process.env.NEXT_PUBLIC_INVOICE_CONTRACT_ID,
    NEXT_PUBLIC_POOL_CONTRACT_ID: process.env.NEXT_PUBLIC_POOL_CONTRACT_ID,
    NEXT_PUBLIC_ESCROW_CONTRACT_ID: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID,
    NEXT_PUBLIC_USDC_ISSUER: process.env.NEXT_PUBLIC_USDC_ISSUER,
    NEXT_PUBLIC_USDC_ASSET_CODE: process.env.NEXT_PUBLIC_USDC_ASSET_CODE,
  };
  const missing = Object.entries(requiredEnv)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  const invalid: string[] = [];

  if (missing.length === 0) {
    const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK || "";
    const horizonUrl = process.env.NEXT_PUBLIC_HORIZON_URL || "";
    const sorobanRpcUrl = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || "";
    const passphrase = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || "";
    const registryId = process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID || "";
    const invoiceId = process.env.NEXT_PUBLIC_INVOICE_CONTRACT_ID || "";
    const poolId = process.env.NEXT_PUBLIC_POOL_CONTRACT_ID || "";
    const escrowId = process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID || "";
    const usdcIssuer = process.env.NEXT_PUBLIC_USDC_ISSUER || "";

    // Validate contract IDs using StrKey.isValidContract
    if (!StrKey.isValidContract(registryId)) {
      invalid.push("NEXT_PUBLIC_REGISTRY_CONTRACT_ID");
    }
    if (!StrKey.isValidContract(invoiceId)) {
      invalid.push("NEXT_PUBLIC_INVOICE_CONTRACT_ID");
    }
    if (!StrKey.isValidContract(poolId)) {
      invalid.push("NEXT_PUBLIC_POOL_CONTRACT_ID");
    }
    if (!StrKey.isValidContract(escrowId)) {
      invalid.push("NEXT_PUBLIC_ESCROW_CONTRACT_ID");
    }

    // Validate USDC issuer using StrKey.isValidEd25519PublicKey
    if (!StrKey.isValidEd25519PublicKey(usdcIssuer)) {
      invalid.push("NEXT_PUBLIC_USDC_ISSUER");
    }

    // Network consistency checks
    const isMainnet = network.toLowerCase() === "mainnet";
    const isTestnet = network.toLowerCase() === "testnet";

    if (isMainnet) {
      if (
        passphrase.includes("Test SDF") ||
        horizonUrl.includes("testnet") ||
        sorobanRpcUrl.includes("testnet")
      ) {
        invalid.push("NEXT_PUBLIC_STELLAR_NETWORK");
      }
    } else if (isTestnet) {
      if (
        passphrase.includes("Public Global") ||
        (!horizonUrl.includes("testnet") &&
          horizonUrl.includes("stellar.org")) ||
        (!sorobanRpcUrl.includes("testnet") &&
          sorobanRpcUrl.includes("stellar.org"))
      ) {
        invalid.push("NEXT_PUBLIC_STELLAR_NETWORK");
      }
    }
  }

  if (missing.length > 0) {
    console.warn(
      `[TrusTrove] Missing required environment variables: ${missing.join(", ")}`,
    );
  }

  if (invalid.length > 0) {
    console.warn(
      `[TrusTrove] Invalid environment variables or network mismatch: ${invalid.join(", ")}`,
    );
  }

  cachedValidation = {
    missing,
    invalid,
    isConfigured: missing.length === 0 && invalid.length === 0,
  };

  return cachedValidation;
}
