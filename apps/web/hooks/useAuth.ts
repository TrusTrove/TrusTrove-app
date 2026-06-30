import { useState } from "react";
import { useWalletStore } from "@/store/wallet";
import { signTransaction } from "@stellar/freighter-api";
import { fetchChallenge, verifyChallenge } from "@/lib/api";

/**
 * Custom hook for authenticating the connected Stellar wallet via SEP-10.
 *
 * Performs a three-step challenge-sign-verify flow:
 * 1. Fetches a challenge transaction XDR from the indexer API via fetchChallenge.
 * 2. Signs the XDR with the Freighter wallet extension.
 * 3. Submits the signed XDR to the indexer via verifyChallenge to receive a JWT.
 *
 * Requires a wallet to be connected first (i.e. `useWallet` must have been called).
 *
 * @returns An object containing:
 *   - `token` — The JWT string when authenticated, otherwise `null`.
 *   - `isAuthenticated` — `true` when a valid JWT token is present.
 *   - `loading` — `true` while the authentication request is in progress.
 *   - `error` — Error message string if authentication failed, otherwise `null`.
 *   - `login` — Async function that initiates the SEP-10 auth flow.
 *   - `logout` — Function that clears the JWT token and disconnects the wallet.
 *
 * @throws All fetch and signing errors are caught internally and surfaced via `error`.
 *   If no wallet address is connected, `login` sets `error` to `'Wallet not connected'`.
 *
 * @example
 * const { isAuthenticated, login, logout, loading, error } = useAuth();
 */
export function useAuth() {
  const { address, token, setToken, disconnect } = useWalletStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Initiates the SEP-10 wallet authentication flow using the api utility functions.
   *
   * @throws Sets `error` state instead of throwing; caller does not need try/catch.
   */
  const login = async () => {
    if (!address) {
      setError("Wallet not connected");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Fetch challenge XDR; network_passphrase is returned by the server
      const { transaction, network_passphrase } = await fetchChallenge(address);

      // 2. Sign with Freighter wallet using dynamic network parameters
      const rawNetwork = process.env.NEXT_PUBLIC_STELLAR_NETWORK || "TESTNET";
      const stellarNetwork =
        rawNetwork.toUpperCase() === "PUBLIC" ? "PUBLIC" : "TESTNET";
      const signedXdr = await signTransaction(transaction, {
        network: "TESTNET",
        networkPassphrase: network_passphrase,
        accountToSign: address,
      });

      // 3. Submit signed challenge to verify and receive JWT
      const { token: jwt } = await verifyChallenge(signedXdr);
      setToken(jwt);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Authentication failed";
      setError(message);
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Logs the user out by clearing the JWT token and disconnecting the wallet.
   */
  const logout = () => {
    setToken(null);
    disconnect();
  };

  return {
    token,
    isAuthenticated: !!token,
    loading,
    error,
    login,
    logout,
  };
}
