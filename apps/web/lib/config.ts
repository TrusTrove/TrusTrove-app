const REQUIRED_ENV_VARS = [
  "NEXT_PUBLIC_INVOICE_CONTRACT_ID",
  "NEXT_PUBLIC_POOL_CONTRACT_ID",
  "NEXT_PUBLIC_REGISTRY_CONTRACT_ID",
] as const;

export interface ConfigValidation {
  missing: string[];
  isConfigured: boolean;
}

let cachedValidation: ConfigValidation | null = null;

export function validateConfig(): ConfigValidation {
  if (cachedValidation) return cachedValidation;

  const missing = REQUIRED_ENV_VARS.filter(
    (key) => !process.env[key] || process.env[key] === "",
  );

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
