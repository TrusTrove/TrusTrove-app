import { useState } from "react";
import { useWalletStore } from "@/store/wallet";
import { connectFreighter, FreighterError } from "@/lib/freighter";
import { useBalances } from "./useBalances";
import { createErrorHandler } from "@/lib/errors";

const { captureError } = createErrorHandler("useWallet");

/**
 * Describes the result of attempting to switch Freighter's network
 * to Testnet through the hook.
 */
export interface NetworkSwitchAction {
  /** `true` when the caller must show the user manual instructions. */
  readonly needsManualSwitch: boolean;
  /** Human-readable message describing what the user should do next. */
  readonly message: string;
  /** URL to open Freighter's network settings panel. */
  readonly switchUrl: string;
}

/**
 * Custom hook for managing Stellar wallet connection via Freighter.
 *
 * Provides wallet state and actions to connect or disconnect a Freighter wallet.
 * Connection defaults to the testnet network.
 *
 * @returns An object containing:
 *   - `address` — The connected wallet's public key, or `null` if not connected.
 *   - `connected` — Whether a wallet is currently connected.
 *   - `network` — The active network identifier (e.g. `'testnet'`).
 *   - `connectWallet` — Async function that opens Freighter and connects the wallet.
 *   - `disconnectWallet` — Function that disconnects the current wallet.
 *   - `switchNetworkToTestnet` — Async function that attempts to switch Freighter
 *     to Testnet and returns a {@link NetworkSwitchAction} with instructions if
 *     a manual switch is needed.
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
   * Sets `loading` to `true` during the attempt. On success, stores the wallet
   * address and defaults the network to `'testnet'`. On failure, stores the error
   * message and calls `disconnect` to ensure a clean state.
   */
  const connectWallet = async () => {
    setLoading(true);
    setError(null);
    setErrorCode(null);
    try {
      const addr = await connectFreighter();
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

  /**
   * Attempts to switch Freighter's active network to Testnet.
   *
   * Freighter's public API does not expose a programmatic network-switch
   * endpoint. When the extension lacks a direct switch API, this function
   * returns a {@link NetworkSwitchAction} with {@link NetworkSwitchAction.needsManualSwitch}
   * set to `true`, carrying a URL that opens Freighter at its
   * network-settings panel so the user can change the network manually.
   *
   * Consumers should present the returned message and link to the user;
   * clicking the link opens Freighter in a new tab (or the extension's
   * built-in browser) at the network-switch UI.
   *
   * @returns A {@link NetworkSwitchAction} describing the outcome of the attempt.
   */
  const switchNetworkToTestnet = async (): Promise<NetworkSwitchAction> => {
    const currentNetwork = await detectFreighterNetwork();
    if (currentNetwork === "testnet") {
      return {
        needsManualSwitch: false,
        message: "Freighter is already on Testnet.",
        switchUrl: "",
      };
    }
    const switchUrl = getFreighterNetworkSwitchUrl();
    return {
      needsManualSwitch: true,
      message: `Your Freighter wallet is on ${currentNetwork}. Please switch to Testnet in Freighter, then reconnect.`,
      switchUrl,
    };
  };

  return {
    address,
    connected,
    network,
    connectWallet,
    disconnectWallet,
    switchNetworkToTestnet,
    loading,
    error,
    errorCode,
    balances,
    balancesLoading,
    balancesError,
    refetchBalances,
  };
}