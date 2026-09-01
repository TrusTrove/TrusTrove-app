/**
 * Validates that a discount basis points value is within the accepted range.
 *
 * @param bps - The discount basis points to validate.
 * @returns `true` if the value is a valid integer between 1 and 10,000 inclusive.
 *
 * @example
 * ```ts
 * validateDiscountBps(200);  // true
 * validateDiscountBps(0);    // false
 * validateDiscountBps(10001); // false
 * ```
 */
export function validateDiscountBps(bps: number): boolean {
  return Number.isInteger(bps) && bps > 0 && bps <= 10000;
}
