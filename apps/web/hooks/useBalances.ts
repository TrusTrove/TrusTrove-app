import { useQuery } from "@tanstack/react-query";
import { Horizon } from "@stellar/stellar-sdk";
import { useWalletStore } from "@/store/wallet";
import { ASSET_INFO } from "@/lib/assets";

export interface Balances {
  usdc: string | null;
  xlm: string | null;
}

const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL || "https://horizon-testnet.stellar.org";

async function fetchBalancesFromHorizon(address: string): Promise<Balances> {
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
}

export function useBalances() {
  const { address, connected } = useWalletStore();

  const query = useQuery({
    queryKey: ["balances", address],
    queryFn: () => fetchBalancesFromHorizon(address!),
    enabled: !!address && connected,
    refetchInterval: 30000,
    retry: false,
  });

  const is404 =
    query.error instanceof Error &&
    "response" in query.error &&
    (query.error as { response?: { status: number } }).response?.status === 404;

  const balances: Balances = !connected
    ? { usdc: null, xlm: null }
    : is404
      ? { usdc: null, xlm: "0" }
      : query.data ?? { usdc: null, xlm: null };

  const error = query.error && !is404 ? "Failed to fetch balances" : null;

  return { balances, loading: query.isLoading, error, refetch: query.refetch };
}
