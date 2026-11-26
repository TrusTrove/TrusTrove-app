import { useQuery } from "@tanstack/react-query";
import { useWalletStore } from "@/store/wallet";
import { ASSET_INFO } from "@/lib/assets";
import { createErrorHandler } from "@/lib/errors";

const { captureError } = createErrorHandler("useBalances");

export interface Balances {
  usdc: string | null;
  xlm: string | null;
}

import { getConfig } from "@trusttrove/sdk";
const HORIZON_URL = getConfig().horizonUrl;

export class OfflineError extends Error {
  readonly isOffline = true;
  constructor(
    message = "You appear to be offline. Please check your network connection.",
  ) {
    super(message);
    this.name = "OfflineError";
  }
}

function isOfflineError(err: unknown): boolean {
  if (err instanceof OfflineError) return true;
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (err instanceof TypeError && err.message.toLowerCase().includes("fetch"))
    return true;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (
      msg.includes("failed to fetch") ||
      msg.includes("network error") ||
      msg.includes("networkrequestfailed") ||
      msg.includes("net::err") ||
      msg.includes("econnrefused") ||
      msg.includes("offline")
    ) {
      return true;
    }
    if ("name" in err && err.name === "NetworkError") {
      return true;
    }
  }
  return false;
}

function isNotFoundError(err: unknown, NotFoundErrorClass?: unknown): boolean {
  if (
    typeof NotFoundErrorClass === "function" &&
    err instanceof (NotFoundErrorClass as new (...args: unknown[]) => unknown)
  ) {
    return true;
  }
  if (err instanceof Error) {
    if (err.name === "NotFoundError") return true;
    if ("response" in err) {
      const resp = (err as { response?: { status?: number } }).response;
      if (resp?.status === 404) return true;
    }
    if ("status" in err && (err as { status?: number }).status === 404) {
      return true;
    }
  }
  return false;
}

async function fetchBalancesFromHorizon(
  address: string,
  connected: boolean,
): Promise<Balances> {
  if (!address || !connected) {
    return { usdc: null, xlm: null };
  }

  let sdkNotFoundErrorClass: unknown;
  try {
    const sdk = await import("@stellar/stellar-sdk");
    const { Horizon, NotFoundError } = sdk;
    sdkNotFoundErrorClass = NotFoundError;
    const server = new Horizon.Server(HORIZON_URL);
    const account = await server.loadAccount(address);
    const usdcIssuer = ASSET_INFO.USDC.issuer;

    let usdc: string | null = null;
    let xlm: string | null = null;

    for (const balance of account.balances) {
      if ("asset_type" in balance) {
        if (balance.asset_type === "native") {
          xlm = balance.balance;
        } else if (
          balance.asset_type === "credit_alphanum4" &&
          "asset_code" in balance &&
          balance.asset_code === "USDC" &&
          "asset_issuer" in balance &&
          balance.asset_issuer === usdcIssuer
        ) {
          usdc = balance.balance;
        }
      }
    }

    return { usdc, xlm };
  } catch (err: unknown) {
    if (isNotFoundError(err, sdkNotFoundErrorClass)) {
      return { usdc: null, xlm: "0" };
    }
    if (isOfflineError(err)) {
      const offlineErr = new OfflineError();
      captureError(offlineErr);
      throw offlineErr;
    }
    captureError(err);
    throw err;
  }
}

/**
 * Custom hook for fetching XLM and USDC balances from the Stellar Horizon API.
 *
 * It automatically polls for updates every 30 seconds while the wallet is connected.
 *
 * @returns An object containing:
 *   - `balances` — An object with `usdc` and `xlm` string balances, or `null` for each if not found/connected.
 *   - `loading` — `true` while the balances are being fetched.
 *   - `error` — A string error message if the fetch fails, or `null` if none.
 *   - `refetch` — Function to manually refresh the balances.
 *
 * @example
 * const { balances, loading, error, refetch } = useBalances();
 * if (!loading) {
 *   console.log("XLM:", balances.xlm, "USDC:", balances.usdc);
 * }
 */
export function useBalances() {
  const address = useWalletStore((s) => s.address);
  const connected = useWalletStore((s) => s.connected);

  const query = useQuery({
    queryKey: ["balances", address, connected],
    queryFn: () => fetchBalancesFromHorizon(address as string, connected),
    enabled: !!address && connected,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
    throwOnError: false,
  });

  const isOffline =
    query.error instanceof OfflineError ||
    (query.error ? isOfflineError(query.error) : false);
  const errorMessage = query.error
    ? isOffline
      ? "You appear to be offline. Please check your network connection."
      : "Failed to fetch balances"
    : null;

  return {
    balances: query.data ?? { usdc: null, xlm: null },
    loading: query.isLoading,
    error: errorMessage,
    isOffline,
    errorObject: query.error ?? null,
    refetch: query.refetch,
  };
}
