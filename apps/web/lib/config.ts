/**
 * Result of validating the required environment variables.
 *
 * @property missing - Names of required env vars that are absent or empty.
 * @property isConfigured - `true` when every required env var is present.
 */
export interface ConfigValidation {
  missing: string[];
  isConfigured: boolean;
}

let cachedValidation: ConfigValidation | null = null;

/**
 * Validates that all required environment variables are set.
 *
 * Checks for `NEXT_PUBLIC_INVOICE_CONTRACT_ID`,
 * `NEXT_PUBLIC_POOL_CONTRACT_ID`, and `NEXT_PUBLIC_REGISTRY_CONTRACT_ID`.
 * Logs a console warning listing any missing variables and caches the result
 * so subsequent calls are free.
 *
 * @returns A {@link ConfigValidation} object describing the current state:
 *   - `missing` — array of env-var names that are absent or empty.
 *   - `isConfigured` — `true` when every required var is present.
 *
 * @example
 * ```ts
 * const { isConfigured, missing } = validateConfig();
 * if (!isConfigured) {
 *   console.error("Missing env vars:", missing);
 * }
 * ```
 */
export function validateConfig(): ConfigValidation {
  if (cachedValidation) return cachedValidation;

  // Next.js only inlines public variables referenced by name in client bundles.
  const requiredEnv = {
    NEXT_PUBLIC_INVOICE_CONTRACT_ID:
      process.env.NEXT_PUBLIC_INVOICE_CONTRACT_ID,
    NEXT_PUBLIC_POOL_CONTRACT_ID: process.env.NEXT_PUBLIC_POOL_CONTRACT_ID,
    NEXT_PUBLIC_REGISTRY_CONTRACT_ID:
      process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID,
  };
  const missing = Object.entries(requiredEnv)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    console.warn(
      `[TrusTrove] Missing required environment variables: ${missing.join(", ")}`,
    );
  }

  cachedValidation = {
    missing,
    isConfigured: missing.length === 0,
  };

  return cachedValidation;
}
