/**
 * Maximum discount the invoice contract accepts on `list_for_financing`.
 *
 * The on-chain method rejects anything above 5000 bps (50%) — see
 * `docs/smart-contracts/invoice-contract.md`. Validating against the same
 * ceiling client-side keeps the user from signing a transaction that is
 * guaranteed to fail on-chain and burn a network fee.
 */
export const MAX_DISCOUNT_BPS = 5000;

/**
 * Validates that a discount basis points value is within the range the
 * invoice contract accepts.
 *
 * @param bps - The discount basis points to validate.
 * @returns `true` if the value is an integer between 1 and
 *   {@link MAX_DISCOUNT_BPS} (5000 = 50%) inclusive.
 *
 * @example
 * ```ts
 * validateDiscountBps(200);   // true
 * validateDiscountBps(0);     // false
 * validateDiscountBps(5001);  // false — above the on-chain cap
 * ```
 */
export function validateDiscountBps(bps: number): boolean {
  return Number.isInteger(bps) && bps > 0 && bps <= MAX_DISCOUNT_BPS;
}
