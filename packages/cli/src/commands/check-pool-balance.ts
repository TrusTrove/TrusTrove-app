import { Command } from "commander";
import { PoolClient, getConfig, toUsdc } from "@trusttrove/sdk";
import { reportError, rpcError, usageError } from "../errors.js";
import { formatNetworkHeader, resolveNetwork } from "../network.js";

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
  /** `testnet` or `mainnet`; defaults to the environment/SDK config. */
  network?: string;
  /** Custom Soroban RPC endpoint. */
  rpcUrl?: string;
  /** Emit structured errors as JSON on stderr. */
  json?: boolean;
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
  try {
    const publicKey =
      options.publicKey ??
      process.env.TRUSTTROVE_PUBLIC_KEY ??
      process.env.NEXT_PUBLIC_PUBLIC_KEY ??
      process.env.PUBLIC_KEY;

    if (!publicKey) {
      throw usageError(
        "Missing public key. Provide --public-key or set TRUSTTROVE_PUBLIC_KEY.",
      );
    }

    const poolContractId =
      options.poolContractId ??
      process.env.TRUSTTROVE_POOL_CONTRACT_ID ??
      process.env.NEXT_PUBLIC_POOL_CONTRACT_ID ??
      process.env.POOL_CONTRACT_ID ??
      getConfig().contractIds.pool;

    if (!poolContractId) {
      throw usageError(
        `Missing pool contract ID. Provide --pool-contract-id or set ` +
          `${POOL_CONTRACT_ID_ENV_VARS.join(", ")} (see .env.example).`,
      );
    }

    const network = resolveNetwork({
      network: options.network,
      rpcUrl: options.rpcUrl,
    });
    console.log(formatNetworkHeader(network));

    const client = new PoolClient(poolContractId);
    let stats;
    try {
      stats = await client.getStats(publicKey);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      throw rpcError(`Failed to fetch pool stats: ${message}`);
    }

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
    reportError(error, { json: options.json });
  }
}

/** Registers `trusttrove check-pool-balance` on the CLI's command router. */
export function registerCheckPoolBalanceCommand(program: Command): Command {
  return program
    .command("check-pool-balance")
    .description("Fetch and print pool balance stats for the configured pool")
    .option("--public-key <key>", "public key for the read-only simulation")
    .option(
      "--pool-contract-id <id>",
      `override the pool contract ID (or set ${POOL_CONTRACT_ID_ENV_VARS.join(", ")})`,
    )
    .option("--network <network>", "Stellar network: testnet or mainnet")
    .option(
      "--rpc-url <url>",
      "custom Soroban RPC endpoint (defaults to the selected network)",
    )
    .option("--json", "emit structured errors as JSON on stderr")
    .action(async (options: CheckPoolBalanceOptions) => {
      await checkPoolBalanceCommand(options);
    });
}
