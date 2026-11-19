import { PoolClient, getConfig, toUsdc } from "@trusttrove/sdk";

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
  const publicKey =
    options.publicKey ??
    process.env.TRUSTTROVE_PUBLIC_KEY ??
    process.env.NEXT_PUBLIC_PUBLIC_KEY ??
    process.env.PUBLIC_KEY;

  if (!publicKey) {
    console.error(
      "Missing public key. Provide --public-key or set TRUSTTROVE_PUBLIC_KEY.",
    );
    process.exitCode = 1;
    return;
  }

  const poolContractId =
    options.poolContractId ??
    process.env.TRUSTTROVE_POOL_CONTRACT_ID ??
    process.env.NEXT_PUBLIC_POOL_CONTRACT_ID ??
    process.env.POOL_CONTRACT_ID ??
    getConfig().contractIds.pool;

  if (!poolContractId) {
    console.error(
      `Missing pool contract ID. Provide --pool-contract-id or set ` +
        `${POOL_CONTRACT_ID_ENV_VARS.join(", ")} (see .env.example).`,
    );
    process.exitCode = 1;
    return;
  }

  try {
    const client = new PoolClient(poolContractId);
    const stats = await client.getStats(publicKey);

    console.log(`Pool contract: ${poolContractId}`);
    console.log(`totalDeposits: ${formatUsdc(stats.totalDeposits)} USDC`);
    console.log(
      `availableLiquidity: ${formatUsdc(stats.availableLiquidity)} USDC`,
    );
    console.log(
      `utilizationRateBps: ${stats.utilizationRateBps} (${(stats.utilizationRateBps / 100).toFixed(2)}%)`,
    );
    console.log(
      `totalYieldDistributed: ${formatUsdc(stats.totalYieldDistributed)} USDC`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(`Failed to fetch pool stats: ${message}`);
    process.exitCode = 1;
  }
}
