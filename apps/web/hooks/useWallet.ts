import { useState } from "react";
import { useWalletStore } from "@/store/wallet";
import {
  connectFreighter,
  getFreighterNetwork,
  FreighterError,
} from "@/lib/freighter";
import { useBalances } from "./useBalances";
import { createErrorHandler } from "@/lib/errors";

const { captureError } = createErrorHandler("useWallet");

const EXPECTED_NETWORK = "testnet";
const WRONG_NETWORK_ERROR_CODE = "wrong_network";

/**
 * Validates that the Freighter wallet is connected to the expected network.
 * Throws an error with code WRONG_NETWORK_ERROR_CODE if the network doesn't match.
 */
async function validateFreighterNetwork(): Promise<void> {
  const { network } = await getFreighterNetwork();
  const normalized = network.trim().toLowerCase();

  if (normalized !== EXPECTED_NETWORK) {
    const error = new Error(
      "Your Freighter wallet is connected to the wrong network. Please switch Freighter to Stellar Testnet and try again.",
    ) as Error & { code: string };
    error.code = WRONG_NETWORK_ERROR_CODE;
    throw error;
  }
}

/**
 * Custom hook for managing Stellar wallet connection via Freighter.
 *
 * Provides wallet state and actions to connect or disconnect a Freighter wallet.
 * Connection defaults to the testnet network and verifies that Freighter is
 * actually configured for testnet before the wallet is stored as connected.
 *
 * @returns An object containing:
 *   - `address` — The connected wallet's public key, or `null` if not connected.
 *   - `connected` — Whether a wallet is currently connected.
 *   - `network` — The active network identifier (e.g. `'testnet'`).
 *   - `connectWallet` — Async function that opens Freighter and connects the wallet.
 *   - `disconnectWallet` — Function that disconnects the current wallet.
 *   - `loading` — `true` while a connection attempt is in progress.
 *   - `error` — Error message string if the last connection attempt failed, otherwise `null`.
 *   - `errorCode` — Error code string if the last connection attempt failed, otherwise `null`.
 *   - `balances` — The connected wallet's balances.
 *   - `balancesLoading` — `true` while balances are being fetched.
 *   - `balancesError` — Fetch error for balances, or `null` if none.
 *   - `refetchBalances` — Function to manually re-trigger the balances query.
 *
 * @example
 * const { address, connected, connectWallet, disconnectWallet, loading, error } = useWallet();
 */
export function useWallet() {
  const { address, connected, network, connect, disconnect } = useWalletStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const {
    balances,
    loading: balancesLoading,
    error: balancesError,
    refetch: refetchBalances,
  } = useBalances();

  const connectWallet = async () => {
    setLoading(true);
    setError(null);
    setErrorCode(null);
    try {
      const addr = await connectFreighter();
      await validateFreighterNetwork();
      connect(addr, EXPECTED_NETWORK);
    } catch (err: unknown) {
      const appError = captureError(err);
      setError(appError.message);
      if (err instanceof FreighterError) {
        setErrorCode(err.code);
      } else if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        typeof err.code === "string"
      ) {
        setErrorCode(err.code);
      }
      disconnect();
    } finally {
      setLoading(false);
    }
  };

  const disconnectWallet = () => {
    disconnect();
  };

  return {
    address,
    connected,
    network,
    connectWallet,
    disconnectWallet,
    loading,
    error,
    errorCode,
    balances,
    balancesLoading,
    balancesError,
    refetchBalances,
  };
}
