import { useState, useEffect, useCallback } from "react";
import { Horizon } from "@stellar/stellar-sdk";
import { useWalletStore } from "@/store/wallet";
import { ASSET_INFO } from "@/lib/assets";

export interface Balances {
  usdc: string | null;
  xlm: string | null;
}

const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL || "https://horizon-testnet.stellar.org";

export function useBalances() {
  const { address, connected } = useWalletStore();
  const [balances, setBalances] = useState<Balances>({ usdc: null, xlm: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalances = useCallback(async () => {
    if (!address || !connected) {
      setBalances({ usdc: null, xlm: null });
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

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

      setBalances({ usdc, xlm });
    } catch (err: unknown) {
      if (err instanceof Error && "response" in err) {
        const resp = (err as { response?: { status: number } }).response;
        if (resp?.status === 404) {
          setBalances({ usdc: null, xlm: "0" });
        } else {
          setError("Failed to fetch balances");
        }
      } else {
        setError("Failed to fetch balances");
      }
    } finally {
      setLoading(false);
    }
  }, [address, connected]);

  useEffect(() => {
    if (!connected) return;
    fetchBalances();
    const interval = setInterval(fetchBalances, 30000);
    return () => clearInterval(interval);
  }, [connected, fetchBalances]);

  return { balances, loading, error, refetch: fetchBalances };
}
