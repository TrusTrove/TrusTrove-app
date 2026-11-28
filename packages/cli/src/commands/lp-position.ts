import { Command } from "commander";
import { PoolClient, toUsdc, type LPPosition } from "@trusttrove/sdk";
import { assertStellarAccountAddress } from "../address.js";
import { reportError, rpcError, usageError } from "../errors.js";
import { formatNetworkHeader, resolveNetwork } from "../network.js";
import { resolvePoolContractId } from "./check-pool-balance.js";

export interface LpPositionOptions {
  /** LP Stellar account address, passed as the positional argument. */
  address?: string;
  /** Public key used for the read-only simulation; defaults to `address`. */
  publicKey?: string;
  /** Address of the pool contract to read from. */
  poolContractId?: string;
  /** `testnet` or `mainnet`; defaults to the environment/SDK config. */
  network?: string;
  /** Custom Soroban RPC endpoint. */
  rpcUrl?: string;
  /** Emit structured errors as JSON on stderr. */
  json?: boolean;
}

/** The position values the command prints, all denominated as the SDK returns. */
export interface LpPositionSummary {
  /** Pool shares owned by the LP (raw share units, not USDC). */
  shares: bigint;
  /** Estimated USDC value of the position, including yield. */
  estimatedAssetValue: bigint;
  /** Estimated original deposit: current value minus accrued yield. */
  principal: bigint;
  /** Yield earned over the position's lifetime. */
  yieldEarned: bigint;
  /** Number of deposits the LP has made. */
  depositCount: number;
}

export interface LpPositionDependencies {
  /** Overridable for tests; defaults to the SDK's `PoolClient`. */
  createClient?: (contractId: string) => Pick<PoolClient, "getLPPosition">;
}

/**
 * Derives principal from the contract's position. `usdc_value` includes the
 * yield earned, so the original deposit is the difference. It is floored at
 * zero because a stale or partial read must not render a negative principal.
 */
export function summarizeLpPosition(position: LPPosition): LpPositionSummary {
  return {
    shares: position.shares,
    estimatedAssetValue: position.usdcValue,
    principal:
      position.usdcValue > position.yieldEarned
        ? position.usdcValue - position.yieldEarned
        : 0n,
    yieldEarned: position.yieldEarned,
    depositCount: position.depositCount,
  };
}

function resolvePublicKey(options: LpPositionOptions, address: string): string {
  const publicKey = (
    options.publicKey ??
    process.env.TRUSTTROVE_PUBLIC_KEY ??
    process.env.NEXT_PUBLIC_PUBLIC_KEY ??
    process.env.PUBLIC_KEY ??
    address
  ).trim();

  if (!publicKey) {
    throw usageError(
      "Missing public key. Provide --public-key or set TRUSTTROVE_PUBLIC_KEY.",
    );
  }
  return publicKey;
}

/**
 * Renders an LP position as labeled lines. Amounts go through the SDK's
 * `toUsdc` formatter so they match every other CLI command's precision; shares
 * stay raw because they are not USDC.
 */
export function formatLpPosition(
  address: string,
  summary: LpPositionSummary,
): string {
  return [
    `LP address: ${address}`,
    `Shares: ${summary.shares.toString()}`,
    `Estimated asset value: ${toUsdc(summary.estimatedAssetValue)} USDC`,
    `Principal: ${toUsdc(summary.principal)} USDC`,
    `Yield earned: ${toUsdc(summary.yieldEarned)} USDC`,
    `Deposits: ${summary.depositCount}`,
  ].join("\n");
}

/**
 * Reads `get_lp_position` for an LP and prints its shares, estimated value,
 * principal, and yield.
 *
 * The address is validated before the network is resolved or the client is
 * constructed, so a malformed address never reaches Soroban RPC.
 */
export async function lpPositionCommand(
  options: LpPositionOptions = {},
  dependencies: LpPositionDependencies = {},
): Promise<void> {
  try {
    const address = assertStellarAccountAddress(options.address ?? "", "LP");
    const publicKey = resolvePublicKey(options, address);
    const poolContractId = resolvePoolContractId(options);
    const network = resolveNetwork({
      network: options.network,
      rpcUrl: options.rpcUrl,
    });

    const createClient =
      dependencies.createClient ?? ((id: string) => new PoolClient(id));
    const client = createClient(poolContractId);

    let position: LPPosition;
    try {
      position = await client.getLPPosition(address, publicKey);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      throw rpcError(`Failed to fetch LP position: ${message}`);
    }

    console.log(formatNetworkHeader(network));
    console.log(`Pool contract: ${poolContractId}`);
    console.log(formatLpPosition(address, summarizeLpPosition(position)));
  } catch (error) {
    reportError(error, { json: options.json });
  }
}

/**
 * Registers `trusttrove lp position <address>`.
 *
 * Output goes to stdout; invalid addresses and configuration fail before any
 * RPC call, and simulation failures are reported on stderr with exit code 2.
 */
export function registerLpPositionCommand(program: Command): Command {
  const lp = program.command("lp").description("Liquidity provider commands");

  return lp
    .command("position")
    .description(
      "Show an LP's shares, estimated asset value, principal, and yield",
    )
    .argument("<address>", "LP Stellar account address (G...)")
    .option(
      "--public-key <key>",
      "public key for the read-only simulation (defaults to the LP address or TRUSTTROVE_PUBLIC_KEY)",
    )
    .option(
      "--pool-contract-id <id>",
      "override the pool contract ID (or set TRUSTTROVE_POOL_CONTRACT_ID)",
    )
    .option("--network <network>", "Stellar network: testnet or mainnet")
    .option(
      "--rpc-url <url>",
      "custom Soroban RPC endpoint (defaults to the selected network)",
    )
    .option("--json", "emit structured errors as JSON on stderr")
    .action(
      async (address: string, options: Omit<LpPositionOptions, "address">) => {
        await lpPositionCommand({ ...options, address });
      },
    );
}
