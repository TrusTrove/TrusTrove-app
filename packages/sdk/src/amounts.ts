/**
 * Number of stroops per whole USDC unit (10^7 = 1 USDC).
 *
 * Stellar on-chain amounts are u128 integers denominated in stroops.
 * All SDK financial methods accept and return `bigint` in stroops.
 */
const STROOPS_PER_USDC = 10_000_000;
const BPS_DENOMINATOR = 10_000n;

/**
 * Converts a stroop-denominated bigint to a human-readable USDC string
 * with exactly two decimal places.
 *
 * @param stroops - The amount in stroops (10^7 = 1 USDC).
 * @returns A formatted string, e.g. `"1.00"`, `"1000.50"`, `"0.01"`.
 *
 * @example
 * ```ts
 * toUsdc(BigInt(10_000_000)); // "1.00"
 * toUsdc(BigInt(10_005_000_000)); // "1000.50"
 * toUsdc(0n); // "0.00"
 * ```
 */
export function toUsdc(stroops: bigint): string {
  // Absolute value for formatting; track sign separately.
  const negative = stroops < 0n;
  const magnitude = negative ? -stroops : stroops;

  const whole = magnitude / BigInt(STROOPS_PER_USDC);
  const fraction = magnitude % BigInt(STROOPS_PER_USDC);
  const fractionStr = fraction.toString().padStart(7, "0").slice(0, 2);

  // Sub-cent magnitudes truncate to "0.00", and "-0.00" is not an amount.
  const isZero = whole === 0n && fractionStr === "00";
  return `${negative && !isZero ? "-" : ""}${whole.toString()}.${fractionStr}`;
}

/**
 * Parses a USDC decimal string into a stroop-denominated bigint.
 *
 * Accepts integers (`"100"`) and decimals with up to 7 fractional digits
 * (`"1000.50"`, `"0.0000001"`). Extra fractional digits beyond 7 are
 * truncated (not rounded).
 *
 * @param usdc - A decimal string, e.g. `"1000.50"`.
 * @returns The amount in stroops as a bigint.
 * @throws {Error} If the input is not a valid decimal number.
 *
 * @example
 * ```ts
 * fromUsdc("1000.50"); // 10005000000n
 * fromUsdc("1"); // 10000000n
 * fromUsdc("0.01"); // 100000n
 * ```
 */
export function fromUsdc(usdc: string): bigint {
  const trimmed = usdc.trim();

  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid USDC amount: "${usdc}"`);
  }

  const negative = trimmed.startsWith("-");
  const magnitude = negative ? trimmed.slice(1) : trimmed;

  const [intPart, fracPart = ""] = magnitude.split(".");
  // Pad or truncate fractional part to exactly 7 digits (stroops precision).
  const paddedFrac = fracPart.padEnd(7, "0").slice(0, 7);

  const stroops = BigInt(intPart + paddedFrac);
  return negative ? -stroops : stroops;
}

function validateNonNegativeAmount(name: string, amount: bigint): void {
  if (amount < 0n) {
    throw new RangeError(`${name} must not be negative`);
  }
}

function calculateDiscountAmount(faceValue: bigint, discountBps: number): bigint {
  validateNonNegativeAmount("faceValue", faceValue);
  if (!Number.isSafeInteger(discountBps) || discountBps < 0 || discountBps > 10_000) {
    throw new RangeError("discountBps must be a whole number from 0 to 10000");
  }

  // Match the web preview: fractional-stroop discounts are rounded up.
  return (
    (faceValue * BigInt(discountBps) + BPS_DENOMINATOR - 1n) /
    BPS_DENOMINATOR
  );
}

/**
 * Calculates the invoice discount in stroops, rounding up to the next stroop
 * when the basis-point calculation has a fractional result.
 *
 * @param faceValue - Invoice face value in stroops.
 * @param discountBps - Discount rate from 0 through 10,000 basis points.
 */
export function calculateDiscount(
  faceValue: bigint,
  discountBps: number,
): bigint {
  return calculateDiscountAmount(faceValue, discountBps);
}

/**
 * Calculates the initial advance: face value less the financing discount.
 *
 * @param faceValue - Invoice face value in stroops.
 * @param discountBps - Discount rate from 0 through 10,000 basis points.
 */
export function calculateAdvance(
  faceValue: bigint,
  discountBps: number,
): bigint {
  return faceValue - calculateDiscountAmount(faceValue, discountBps);
}

/**
 * Calculates the time-proportional discount refund for early repayment.
 * Integer division rounds down to the nearest stroop.
 *
 * @param discountAmount - Original financing discount in stroops.
 * @param remainingTerm - Time remaining at repayment, in the same units as `totalTerm`.
 * @param totalTerm - Original financing term; must be greater than zero.
 */
export function calculateEarlyRepaymentRefund(
  discountAmount: bigint,
  remainingTerm: bigint,
  totalTerm: bigint,
): bigint {
  validateNonNegativeAmount("discountAmount", discountAmount);
  if (totalTerm <= 0n) {
    throw new RangeError("totalTerm must be greater than zero");
  }
  if (remainingTerm < 0n || remainingTerm > totalTerm) {
    throw new RangeError("remainingTerm must be between zero and totalTerm");
  }
  return (discountAmount * remainingTerm) / totalTerm;
}

/**
 * Calculates net proceeds after adding any early-repayment refund to the
 * initial advance.
 *
 * @param advance - Initial advance in stroops.
 * @param earlyRepaymentRefund - Discount refund in stroops, or zero.
 */
export function calculateNetProceeds(
  advance: bigint,
  earlyRepaymentRefund: bigint = 0n,
): bigint {
  validateNonNegativeAmount("advance", advance);
  validateNonNegativeAmount("earlyRepaymentRefund", earlyRepaymentRefund);
  return advance + earlyRepaymentRefund;
}
