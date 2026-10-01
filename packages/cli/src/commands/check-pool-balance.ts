import { PoolClient, getConfig } from "@trusttrove/sdk";

const USDC_STROOPS = 10_000_000n;

function formatUsdc(value: bigint): string {
  const whole = value / USDC_STROOPS;
  const fractional = (value % USDC_STROOPS).toString().padStart(7, "0");
  const trimmedFractional = fractional.replace(/0+$/, "");
  return trimmedFractional ? `${whole}.${trimmedFractional}` : `${whole}`;
}

export interface CheckPoolBalanceOptions {
  publicKey?: string;
  poolContractId?: string;
}

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
    getConfig().contractIds.pool;

  if (!poolContractId) {
    console.error(
      "Missing pool contract ID. Provide --pool-contract-id or set TRUSTTROVE_POOL_CONTRACT_ID.",
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
