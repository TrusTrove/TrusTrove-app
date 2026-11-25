import { configureSDK } from "@trusttrove/sdk";
import { redactUrl, usageError } from "./errors.js";

/**
 * Stellar network presets used by the CLI's `--network` flag. The passphrases
 * are the canonical Stellar values; the SDK does not re-export them, and the
 * CLI does not otherwise depend on `@stellar/stellar-sdk`.
 */
export const NETWORK_PRESETS = {
  testnet: {
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
    rpcHosts: ["soroban-testnet.stellar.org", "testnet.sorobanrpc.com"],
  },
  mainnet: {
    rpcUrl: "https://soroban-mainnet.stellar.org",
    networkPassphrase: "Public Global Stellar Network ; September 2015",
    rpcHosts: ["soroban-mainnet.stellar.org", "mainnet.sorobanrpc.com"],
  },
} as const;

export type KnownNetwork = keyof typeof NETWORK_PRESETS;
export const KNOWN_NETWORKS = Object.keys(NETWORK_PRESETS) as KnownNetwork[];

export interface NetworkOptions {
  /** `testnet` or `mainnet`. */
  network?: string;
  /** Custom Soroban RPC endpoint. */
  rpcUrl?: string;
}

export interface ResolvedNetwork {
  /** `testnet`, `mainnet`, or `custom` when the passphrase is not a preset. */
  name: string;
  sorobanRpcUrl: string;
  networkPassphrase: string;
  /** True when the RPC endpoint is not the preset endpoint for `name`. */
  isCustomRpc: boolean;
}

function parseKnownNetwork(
  value: string,
  source: string,
): KnownNetwork | undefined {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (!KNOWN_NETWORKS.includes(normalized as KnownNetwork)) {
    throw usageError(
      `Unknown network "${value}" from ${source}. Expected one of: ${KNOWN_NETWORKS.join(", ")}.`,
    );
  }
  return normalized as KnownNetwork;
}

function networkForPassphrase(passphrase: string): KnownNetwork | undefined {
  return KNOWN_NETWORKS.find(
    (name) => NETWORK_PRESETS[name].networkPassphrase === passphrase,
  );
}

function networkForHost(url: string): KnownNetwork | undefined {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }
  return KNOWN_NETWORKS.find((name) =>
    (NETWORK_PRESETS[name].rpcHosts as readonly string[]).includes(hostname),
  );
}

function validateRpcUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw usageError(`Invalid RPC URL "${url}". Expected an http(s) URL.`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw usageError(
      `Invalid RPC URL "${redactUrl(url)}". Expected an http(s) URL.`,
    );
  }
  return url;
}

function assertHostMatches(url: string, network: KnownNetwork) {
  const hostNetwork = networkForHost(url);
  if (hostNetwork && hostNetwork !== network) {
    throw usageError(
      `Conflicting network configuration: --network ${network} cannot use the ${hostNetwork} RPC endpoint ${redactUrl(url)}.`,
    );
  }
}

/**
 * Resolves the network a read command should use and applies it through the
 * SDK's `configureSDK`. Precedence:
 *
 * 1. `--network` + optional `--rpc-url`.
 * 2. `--rpc-url` alone, with the passphrase from `NEXT_PUBLIC_NETWORK_PASSPHRASE`
 *    or `NEXT_PUBLIC_STELLAR_NETWORK` (and inferred from a known host).
 * 3. Environment configuration (`NEXT_PUBLIC_*`), falling back to testnet.
 *
 * Contradictory sources are rejected instead of silently picking one, which is
 * what lets `--network mainnet` never run against a testnet endpoint.
 */
export function resolveNetwork(options: NetworkOptions = {}): ResolvedNetwork {
  const requested = options.network
    ? parseKnownNetwork(options.network, "--network")
    : undefined;
  const envNetwork = process.env.NEXT_PUBLIC_STELLAR_NETWORK
    ? parseKnownNetwork(
        process.env.NEXT_PUBLIC_STELLAR_NETWORK,
        "NEXT_PUBLIC_STELLAR_NETWORK",
      )
    : undefined;
  const envPassphrase =
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE?.trim() || undefined;
  const envRpcUrl =
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL?.trim() || undefined;
  const explicitRpcUrl = options.rpcUrl?.trim() || undefined;

  const envPassphraseNetwork = envPassphrase
    ? networkForPassphrase(envPassphrase)
    : undefined;
  if (
    envNetwork &&
    envPassphraseNetwork &&
    envNetwork !== envPassphraseNetwork
  ) {
    throw usageError(
      `Conflicting network configuration: NEXT_PUBLIC_STELLAR_NETWORK is ${envNetwork} but NEXT_PUBLIC_NETWORK_PASSPHRASE describes ${envPassphraseNetwork}.`,
    );
  }

  if (requested && envNetwork && requested !== envNetwork) {
    throw usageError(
      `Conflicting network configuration: --network ${requested} disagrees with NEXT_PUBLIC_STELLAR_NETWORK=${envNetwork}.`,
    );
  }
  if (requested && envPassphraseNetwork && requested !== envPassphraseNetwork) {
    throw usageError(
      `Conflicting network configuration: --network ${requested} disagrees with NEXT_PUBLIC_NETWORK_PASSPHRASE.`,
    );
  }

  if (requested) {
    const preset = NETWORK_PRESETS[requested];
    const rpcUrl = validateRpcUrl(explicitRpcUrl ?? preset.rpcUrl);
    assertHostMatches(rpcUrl, requested);
    configureSDK({
      sorobanRpcUrl: rpcUrl,
      networkPassphrase: preset.networkPassphrase,
    });
    return {
      name: requested,
      sorobanRpcUrl: rpcUrl,
      networkPassphrase: preset.networkPassphrase,
      isCustomRpc: rpcUrl !== preset.rpcUrl,
    };
  }

  const defaultNetwork = envNetwork ?? envPassphraseNetwork ?? "testnet";
  const rpcUrl = validateRpcUrl(
    explicitRpcUrl ?? envRpcUrl ?? NETWORK_PRESETS[defaultNetwork].rpcUrl,
  );
  const hostNetwork = networkForHost(rpcUrl);
  if (envNetwork && hostNetwork && envNetwork !== hostNetwork) {
    throw usageError(
      `Conflicting network configuration: NEXT_PUBLIC_STELLAR_NETWORK is ${envNetwork} but the RPC endpoint is ${redactUrl(rpcUrl)} (${hostNetwork}).`,
    );
  }
  if (
    envPassphraseNetwork &&
    hostNetwork &&
    envPassphraseNetwork !== hostNetwork
  ) {
    throw usageError(
      `Conflicting network configuration: NEXT_PUBLIC_NETWORK_PASSPHRASE describes ${envPassphraseNetwork} but the RPC endpoint is ${redactUrl(rpcUrl)} (${hostNetwork}).`,
    );
  }

  // An explicit, unrecognized passphrase always means a custom network; a
  // known preset host must not relabel it as testnet/mainnet.
  const name: string =
    envPassphrase && !envPassphraseNetwork
      ? "custom"
      : (envNetwork ?? envPassphraseNetwork ?? hostNetwork ?? "custom");
  const networkPassphrase =
    envPassphrase ??
    (envNetwork
      ? NETWORK_PRESETS[envNetwork].networkPassphrase
      : hostNetwork
        ? NETWORK_PRESETS[hostNetwork].networkPassphrase
        : NETWORK_PRESETS.testnet.networkPassphrase);
  const presetRpcUrl =
    name === "custom"
      ? undefined
      : NETWORK_PRESETS[name as KnownNetwork].rpcUrl;

  configureSDK({ sorobanRpcUrl: rpcUrl, networkPassphrase });
  return {
    name,
    sorobanRpcUrl: rpcUrl,
    networkPassphrase,
    isCustomRpc: rpcUrl !== presetRpcUrl,
  };
}

/**
 * The two-line header every read command prints so the selected network is
 * explicit. The RPC URL is redacted to keep provider API keys out of logs.
 */
export function formatNetworkHeader(network: ResolvedNetwork): string {
  const suffix = network.isCustomRpc ? " (custom RPC)" : "";
  return `Network: ${network.name}${suffix}\nRPC: ${redactUrl(network.sorobanRpcUrl)}`;
}
