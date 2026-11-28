/**
 * The notification-preference storage contract shared by the profile page and
 * the settings page (both render a toggle per category) and read by
 * `hooks/useNotifications` when it decides which events to surface.
 *
 * Preferences are scoped to a wallet address, so every reader and writer must
 * derive the key from the address that is active at that moment.
 */

/** The invoice lifecycle events a user can mute, in display order. */
export const NOTIFICATION_CATEGORIES = [
  "Invoice Created",
  "Invoice Listed",
  "Invoice Funded",
  "Invoice Shipped",
  "Delivery Confirmed",
  "Invoice Repaid",
  "Invoice Defaulted",
];

/** `localStorage` key holding the muted/allowed categories for `address`. */
export function prefsStorageKey(address: string): string {
  return `trusttrove_prefs_${address}`;
}

/**
 * Reads the stored preferences for `storageKey`.
 *
 * @returns The saved map, or a map with every category enabled when nothing is
 *   stored or the stored value cannot be parsed.
 */
export function readStoredPrefs(storageKey: string): Record<string, boolean> {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) return JSON.parse(stored) as Record<string, boolean>;
  } catch {
    // Ignore storage errors and fall back to the defaults below.
  }
  const defaults: Record<string, boolean> = {};
  NOTIFICATION_CATEGORIES.forEach((category) => (defaults[category] = true));
  return defaults;
}
