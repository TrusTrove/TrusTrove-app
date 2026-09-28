import { useQuery } from "@tanstack/react-query";
import { Horizon } from "@stellar/stellar-sdk";
import { useWalletStore } from "@/store/wallet";
import { ASSET_INFO } from "@/lib/assets";
import { createErrorHandler } from "@/lib/errors";

const { captureError } = createErrorHandler("useBalances");

export interface Balances {
  usdc: string | null;
  xlm: string | null;
}

const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL || "https://horizon-testnet.stellar.org";

async function fetchBalancesFromHorizon(
  address: string,
  connected: boolean,
): Promise<Balances> {
  if (!address || !connected) {
    return { usdc: null, xlm: null };
  }

  try {
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
    if (err instanceof Error && "response" in err) {
      const resp = (err as { response?: { status: number } }).response;
      if (resp?.status === 404) {
        return { usdc: null, xlm: "0" };
      }
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
    initialData: { usdc: null, xlm: null },
    throwOnError: false,
  });

  return {
    balances: query.data,
    loading: query.isLoading,
    error: query.error ? "Failed to fetch balances" : null,
    refetch: query.refetch,
  };
}
