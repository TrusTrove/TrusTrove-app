import { useState } from 'react';
import { useWalletStore } from '@/store/wallet';
import { signTransaction } from '@stellar/freighter-api';
import { Networks } from '@stellar/stellar-sdk';

/**
 * Custom hook for authenticating the connected Stellar wallet via SEP-10.
 *
 * Performs a three-step challenge-sign-verify flow:
 * 1. Fetches a challenge transaction XDR from the indexer API.
 * 2. Signs the XDR with the Freighter wallet extension.
 * 3. Submits the signed XDR to the indexer to receive a JWT.
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
   * Initiates the SEP-10 wallet authentication flow.
   *
   * Fetches a challenge XDR from `NEXT_PUBLIC_INDEXER_API_URL`, signs it via
   * Freighter using `NEXT_PUBLIC_NETWORK_PASSPHRASE` (defaults to Testnet),
   * then submits the signed transaction to obtain and store a JWT.
   *
   * @throws Sets `error` state instead of throwing; caller does not need try/catch.
   */
  const login = async () => {
    if (!address) {
      setError('Wallet not connected');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_INDEXER_API_URL || 'http://localhost:8080';

      // 1. Fetch challenge XDR
      const challengeRes = await fetch(`${apiBaseUrl}/auth?address=${address}`);
      if (!challengeRes.ok) {
        throw new Error(`Failed to fetch auth challenge: ${challengeRes.statusText}`);
      }
      const challengeData = await challengeRes.json();
      const { transaction } = challengeData;

      // 2. Sign with Freighter wallet
      const networkPassphrase = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || Networks.TESTNET;
      const signedXdr = await signTransaction(transaction, {
        network: 'TESTNET',
        networkPassphrase,
        accountToSign: address,
      });

      // 3. Submit signed challenge to verify and receive JWT
      const verifyRes = await fetch(`${apiBaseUrl}/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transaction: signedXdr }),
      });

      if (!verifyRes.ok) {
        throw new Error('Authentication failed');
      }

      const verifyData = await verifyRes.json();
      setToken(verifyData.token);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
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
