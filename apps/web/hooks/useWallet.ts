import { useState } from "react";
import { getNetworkDetails } from "@stellar/freighter-api";
import { useWalletStore } from "@/store/wallet";
import { connectFreighter, FreighterError } from "@/lib/freighter";
import { useBalances } from "./useBalances";
import { createErrorHandler } from "@/lib/errors";

const { captureError } = createErrorHandler("useWallet");
const REQUIRED_NETWORK = "TESTNET";

/**
 * Custom hook for managing Stellar wallet connection via Freighter.
 *
 * Provides wallet state and actions to connect or disconnect a Freighter wallet.
 * Connection defaults to the testnet network and verifies that Freighter is
 * connected to testnet before storing the wallet connection.
 *
 * @returns An object containing:
 *   - `address` — The connected wallet's public key, or `null` if not connected.
 *   - `connected` — Whether a wallet is currently connected.
 *   - `network` — The active network identifier (e.g. `'testnet'`).
 *   - `connectWallet` — Async function that opens Freighter and connects the wallet.
 *   - `disconnectWallet` — Function that disconnects the current wallet.
 *   - `loading` — `true` while a connection attempt is in progress.
 *   - `error` — Error message string if the last connection attempt failed, otherwise `null`.
 *
 * @throws Will catch errors from Freighter and surface them via the `error` return value
 *   rather than throwing to the caller.
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

  /**
   * Initiates a Freighter wallet connection.
   *
   * Freighter's active network is checked after the wallet access request and
   * before the wallet is added to application state. This prevents signing or
   * submitting transactions against a different Stellar network.
   */
  const connectWallet = async () => {
    setLoading(true);
    setError(null);
    setErrorCode(null);
    try {
      const addr = await connectFreighter();
      const networkDetails = await getNetworkDetails();
      const actualNetwork = String(networkDetails.network).toUpperCase();

      if (actualNetwork !== REQUIRED_NETWORK) {
        throw new FreighterError(
          "wrong_network",
          `Freighter is connected to ${actualNetwork}. Switch Freighter to Testnet before connecting.`,
        );
      }

      connect(addr, "testnet");
    } catch (err: unknown) {
      const appError = captureError(err);
      setError(appError.message);
      if (err instanceof FreighterError) {
        setErrorCode(err.code);
      }
      disconnect();
    } finally {
      setLoading(false);
    }
  };

  /**
   * Disconnects the currently connected wallet by clearing wallet state from the store.
   */
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
