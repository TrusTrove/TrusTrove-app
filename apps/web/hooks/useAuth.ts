import { useRef, useState } from "react";
import { useWalletStore } from "@/store/wallet";
import { signTransaction } from "@stellar/freighter-api";
import { fetchChallenge, verifyChallenge } from "@/lib/api";
import { createErrorHandler } from "@/lib/errors";
import { useAppError } from "./useAppError";

const { captureError } = createErrorHandler("useAuth");

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
 * `logout` also invalidates any `login` that is still in flight, so a JWT that
 * arrives after the user ended the session is discarded instead of being
 * written back into the store (see `sessionRef` below).
 *
 * @throws All fetch and signing errors are caught internally and surfaced via `error`.
 *   If no wallet address is connected, `login` sets `error` to `'Wallet not connected'`.
 *
 * @example
 * const { isAuthenticated, login, logout, loading, error } = useAuth();
 */
export function normalizeNetworkForAuth(raw: string | undefined): string {
  const network = raw || "TESTNET";
  return network.toUpperCase() === "PUBLIC" ? "PUBLIC" : "TESTNET";
}

export function useAuth() {
  const address = useWalletStore((s) => s.address);
  const token = useWalletStore((s) => s.token);
  const setToken = useWalletStore((s) => s.setToken);
  const disconnect = useWalletStore((s) => s.disconnect);
  const [loading, setLoading] = useState(false);
  const { error, handleError, clearError } = useAppError();

  /**
   * Generation counter for the current auth session, bumped by `logout`.
   *
   * `login` is asynchronous (challenge -> wallet signature -> verify), so a
   * logout can land while it is still awaiting. Without this guard the late
   * `setToken(jwt)` would resurrect a credential for a session the user already
   * ended — the stale-bearer-token bug of issue #637, arriving by a race rather
   * than by a cached copy. `login` captures the generation it started in and
   * only writes auth state back when it is still the current one.
   */
  const sessionRef = useRef(0);

  /**
   * Initiates the SEP-10 wallet authentication flow using the api utility functions.
   *
   * @throws Sets `error` state instead of throwing; caller does not need try/catch.
   */
  const login = async () => {
    if (!address) {
      handleError(new Error("Wallet not connected"));
      return;
    }

    const session = sessionRef.current;
    setLoading(true);
    clearError();

    try {
      const { transaction, network_passphrase } = await fetchChallenge(address);

      const stellarNetwork = normalizeNetworkForAuth(
        process.env.NEXT_PUBLIC_STELLAR_NETWORK,
      );
      const signedXdr = await signTransaction(transaction, {
        network: "TESTNET",
        networkPassphrase: network_passphrase,
        accountToSign: address,
      });

      const { token: jwt } = await verifyChallenge(signedXdr);
      // The session ended (or restarted) while this flow was awaiting: drop the
      // JWT rather than authenticating a session the user has logged out of.
      if (session !== sessionRef.current) return;
      setToken(jwt);
    } catch (err: unknown) {
      // Always record the failure for diagnostics, but only surface it — and
      // only clear the token — while this attempt still owns the session. A
      // late failure must not wipe a token a newer login already obtained, nor
      // repopulate an error banner that `logout` has just cleared.
      const appError = captureError(err);
      if (session !== sessionRef.current) return;
      handleError(appError);
      setToken(null);
    } finally {
      if (session === sessionRef.current) {
        setLoading(false);
      }
    }
  };

  /**
   * Logs the user out by clearing the JWT token and disconnecting the wallet.
   *
   * Bumping `sessionRef` first neutralizes any `login` still awaiting, so no
   * credential can be written back into the store after this point.
   */
  const logout = () => {
    sessionRef.current += 1;
    setToken(null);
    disconnect();
    clearError();
    setLoading(false);
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
