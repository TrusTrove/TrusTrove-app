import { useCallback } from "react";
import { useWalletStore } from "@/store/wallet";

/**
 * Custom hook that provides an `ensureAllowance` helper for gating on-chain
 * USDC transfers behind a token approval step.
 *
 * Before calling a smart-contract method that performs `transfer_from` (e.g.
 * pool deposit, invoice repay), call `ensureAllowance` with the spender
 * contract address and the required amount.  If the current on-chain
 * allowance is already sufficient the call resolves immediately; otherwise
 * it prompts the user via Freighter to sign an `approve` transaction and
 * waits for on-chain confirmation before resolving.
 *
 * @returns An object containing:
 *   - `ensureAllowance` — async function that checks / sets USDC allowance.
 *
 * @throws `Error('Wallet not connected')` if no wallet address is available.
 *
 * @example
 * ```ts
 * const { ensureAllowance } = useTokenAllowance();
 *
 * // Inside a mutation:
 * await ensureAllowance(poolContractID, depositAmount);
 * await poolClient.deposit(address, depositAmount, address);
 * ```
 */
export function useTokenAllowance() {
  const address = useWalletStore((s) => s.address);

  const ensureAllowance = useCallback(
    async (spenderContractId: string, amount: bigint): Promise<void> => {
      if (!address) throw new Error("Wallet not connected");

      // Both imports are deferred so the SDK is only downloaded when an
      // allowance actually has to be read or approved (#995). `sdkConfig` is
      // imported here (rather than at module scope) so it still applies the
      // web app's USDC issuer/RPC config before the client is constructed
      // (#1090).
      const [{ TokenClient, getConfig, getSorobanServer }] = await Promise.all([
        import("@trusttrove/sdk"),
        import("@/lib/sdkConfig"),
      ]);

      const tokenClient = TokenClient.forUSDC();

      // 1. Read current on-chain allowance
      const currentAllowance = await tokenClient.allowance(
        address,
        spenderContractId,
        address,
      );

      // 2. If sufficient, nothing to do
      if (currentAllowance >= amount) return;

      // 3. Determine an expiration ledger from SDK config (must not exceed the
      //    network's maximum entry TTL).
      const server = getSorobanServer();
      const latestLedger = await server.getLatestLedger();
      const allowanceExpiryLedgers =
        getConfig().allowanceExpiryLedgers ?? 535_680;
      const expirationLedger = latestLedger.sequence + allowanceExpiryLedgers;

      // 4. Prompt user to approve — Freighter will show a signing dialog
      await tokenClient.approve(
        address,
        spenderContractId,
        amount,
        expirationLedger,
        address,
      );
    },
    [address],
  );

  return { ensureAllowance };
}
