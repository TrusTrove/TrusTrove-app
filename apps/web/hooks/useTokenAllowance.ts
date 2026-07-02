import { useCallback } from 'react';
import { TokenClient, getSorobanServer } from '@trusttrove/sdk';
import { useWalletStore } from '@/store/wallet';

/**
 * Default approval expiration offset in ledger sequences.
 *
 * 535 680 ledgers ≈ 31 days on Stellar (assuming ~5 s per ledger).
 * This gives the user a comfortable window before they need to re-approve.
 */
const APPROVAL_LEDGER_OFFSET = 535_680;

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
  const { address } = useWalletStore();

  const ensureAllowance = useCallback(
    async (spenderContractId: string, amount: bigint): Promise<void> => {
      if (!address) throw new Error('Wallet not connected');

      const tokenClient = TokenClient.forUSDC();

      // 1. Read current on-chain allowance
      const currentAllowance = await tokenClient.allowance(
        address,
        spenderContractId,
        address
      );

      // 2. If sufficient, nothing to do
      if (currentAllowance >= amount) return;

      // 3. Determine an expiration ledger (current + ~31 days)
      const server = getSorobanServer();
      const latestLedger = await server.getLatestLedger();
      const expirationLedger = latestLedger.sequence + APPROVAL_LEDGER_OFFSET;

      // 4. Prompt user to approve — Freighter will show a signing dialog
      await tokenClient.approve(
        address,
        spenderContractId,
        amount,
        expirationLedger,
        address
      );
    },
    [address]
  );

  return { ensureAllowance };
}
