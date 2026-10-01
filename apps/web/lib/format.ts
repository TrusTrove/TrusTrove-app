/**
 * Truncates a blockchain address for display, showing the first 6 and last 4 characters.
 *
 * @param addr - The full address string to truncate.
 * @returns The truncated address with ellipsis, or an empty string if the input is falsy.
 *
 * @example
 * ```ts
 * truncateAddress("GBBD47IF6LZ72Y..."); // "GBBD47...Y..."
 * ```
 */
export function truncateAddress(addr: string): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
