import {
  PoolClient,
  configureSDK,
  getConfig,
  toUsdc,
  type SDKConfig,
} from "@trusttrove/sdk";

/**
 * Pool stats are denominated in stroops, so the SDK formatter is the single
 * source of truth for how an amount is rendered. Going through it keeps this
 * command's output at the same two-decimal precision as `list-invoices`.
 */
export function formatUsdc(value: bigint): string {
  return toUsdc(value);
}

export interface CheckPoolBalanceOptions {
  publicKey?: string;
  poolContractId?: string;
  rpcUrl?: string;
  networkPassphrase?: string;
}

/** Env vars that can stand in for `--pool-contract-id`, in precedence order. */
export const POOL_CONTRACT_ID_ENV_VARS = [
  "TRUSTTROVE_POOL_CONTRACT_ID",
  "NEXT_PUBLIC_POOL_CONTRACT_ID",
  "POOL_CONTRACT_ID",
] as const;

export async function checkPoolBalanceCommand(
  options: CheckPoolBalanceOptions = {},
): Promise<void> {
  const publicKey = options.publicKey ?? process.env.TRUSTTROVE_PUBLIC_KEY;

  if (!publicKey) {
    console.error(
      "Missing public key. Provide --public-key or set TRUSTTROVE_PUBLIC_KEY.",
    );
    process.exitCode = 1;
    return;
  }

  const sorobanRpcUrl = options.rpcUrl ?? process.env.TRUSTTROVE_RPC_URL;
  const networkPassphrase =
    options.networkPassphrase ?? process.env.TRUSTTROVE_NETWORK_PASSPHRASE;

  const sdkOverrides: Partial<SDKConfig> = {};
  if (sorobanRpcUrl) {
    sdkOverrides.sorobanRpcUrl = sorobanRpcUrl;
  }
  if (networkPassphrase) {
    sdkOverrides.networkPassphrase = networkPassphrase;
  }
  if (Object.keys(sdkOverrides).length > 0) {
    configureSDK(sdkOverrides);
  }

  const config = getConfig();
  const poolContractId =
    options.poolContractId ??
    process.env.TRUSTTROVE_POOL_CONTRACT_ID ??
    process.env.NEXT_PUBLIC_POOL_CONTRACT_ID ??
    process.env.POOL_CONTRACT_ID ??
    config.contractIds.pool;

  if (!poolContractId) {
    console.error(
      `Missing pool contract ID. Provide --pool-contract-id or set ` +
        `${POOL_CONTRACT_ID_ENV_VARS.join(", ")} (see .env.example).`,
    );
    process.exitCode = 1;
    return;
  }

  const assetCode = config.usdc?.assetCode || "USDC";

  try {
    const client = new PoolClient(poolContractId);
    const stats = await client.getStats(publicKey);

    console.log(`RPC URL: ${config.sorobanRpcUrl}`);
    console.log(`Network: ${config.networkPassphrase}`);
    console.log(`Pool contract: ${poolContractId}`);
    console.log(`totalDeposits: ${formatUsdc(stats.totalDeposits)} ${assetCode}`);
    console.log(
      `availableLiquidity: ${formatUsdc(stats.availableLiquidity)} ${assetCode}`,
    );
    console.log(
      `utilizationRateBps: ${stats.utilizationRateBps} (${(stats.utilizationRateBps / 100).toFixed(2)}%)`,
    );
    console.log(
      `totalYieldDistributed: ${formatUsdc(stats.totalYieldDistributed)} ${assetCode}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(`Failed to fetch pool stats: ${message}`);
    process.exitCode = 1;
  }
}
