import { usageError } from "./errors.js";

/** Matches a Stellar account (public key) address, but not contract IDs. */
export const STELLAR_ACCOUNT_PATTERN = /^G[A-Z2-7]{55}$/;

export function isStellarAccountAddress(value: string): boolean {
  return STELLAR_ACCOUNT_PATTERN.test(value);
}

/**
 * Validates a Stellar account address given on the command line. Commands call
 * this before any RPC or HTTP request so a typo is a usage error rather than a
 * remote failure, and so an invalid value is never embedded in a URL.
 *
 * @throws {CliError} With {@link EXIT_USAGE} when the value is not a G... address.
 */
export function assertStellarAccountAddress(
  value: string,
  field: string,
): string {
  const trimmed = value.trim();
  if (!isStellarAccountAddress(trimmed)) {
    throw usageError(
      `Invalid ${field} address "${value}". Expected a 56-character Stellar account address starting with G.`,
    );
  }
  return trimmed;
}
