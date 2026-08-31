import { useRef, useState } from "react";
import { getNetworkDetails } from "@stellar/freighter-api";
import { useWalletStore } from "@/store/wallet";
import { connectFreighter, FreighterError } from "@/lib/freighter";
import { useBalances } from "./useBalances";
import { createErrorHandler } from "@/lib/errors";

const { captureError } = createErrorHandler("useWallet");
const REQUIRED_NETWORK = "testnet";

const EXPECTED_NETWORK = "testnet";
const WRONG_NETWORK_ERROR_CODE = "wrong_network";
const WRONG_NETWORK_ERROR_MESSAGE =
  "Your Freighter wallet is connected to the wrong network. Please switch Freighter to Stellar Testnet and try again.";

interface FreighterNetworkDetails {
  network?: string;
}

async function validateFreighterNetwork(): Promise<void> {
  const details = (await getNetworkDetails()) as FreighterNetworkDetails;
  const network = details.network?.trim().toLowerCase();

  if (network !== EXPECTED_NETWORK) {
    const error = new Error(WRONG_NETWORK_ERROR_MESSAGE) as Error & {
      code: string;
    };
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
 *
 * @throws Will catch errors from Freighter and surface them via the `error` return value
 *   rather than throwing to the caller.
 *
 * @example
 * const { address, connected, connectWallet, disconnectWallet, loading, error } = useWallet();
 */
export function useWallet() {
  const address = useWalletStore((s) => s.address);
  const connected = useWalletStore((s) => s.connected);
  const network = useWalletStore((s) => s.network);
  const connect = useWalletStore((s) => s.connect);
  const disconnect = useWalletStore((s) => s.disconnect);
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
   * Sets `loading` to `true` during the attempt. On success, stores the wallet
   * address and defaults the network to `'testnet'`. The connection is rejected
   * if Freighter reports a different active network.
   */
  const connectingRef = useRef(false);

  const connectWallet = async () => {
    if (connectingRef.current) return;
    connectingRef.current = true;
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
      connectingRef.current = false;
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
