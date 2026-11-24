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

/** `localStorage` key holding the muted invoice IDs for `address`. */
export function mutedInvoicesStorageKey(address: string): string {
  return `trusttrove_muted_invoices_${address}`;
}

/**
 * Reads the list of muted invoice IDs for `address`.
 */
export function readMutedInvoices(storageKey: string): string[] {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
      }
    }
  } catch {
    // Ignore storage errors and fall back to empty list.
  }
  return [];
}

/**
 * Checks whether a specific invoice is muted.
 */
export function isInvoiceMuted(storageKey: string, invoiceId: string): boolean {
  if (!invoiceId) return false;
  const muted = readMutedInvoices(storageKey);
  return muted.includes(invoiceId);
}

/**
 * Mutes an invoice locally.
 */
export function muteInvoice(storageKey: string, invoiceId: string): string[] {
  if (!invoiceId) return readMutedInvoices(storageKey);
  const muted = readMutedInvoices(storageKey);
  if (!muted.includes(invoiceId)) {
    const updated = [...muted, invoiceId];
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {
      // Ignore storage write errors.
    }
    return updated;
  }
  return muted;
}

/**
 * Unmutes an invoice locally.
 */
export function unmuteInvoice(storageKey: string, invoiceId: string): string[] {
  if (!invoiceId) return readMutedInvoices(storageKey);
  const muted = readMutedInvoices(storageKey);
  const updated = muted.filter((id) => id !== invoiceId);
  if (updated.length !== muted.length) {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {
      // Ignore storage write errors.
    }
  }
  return updated;
}
