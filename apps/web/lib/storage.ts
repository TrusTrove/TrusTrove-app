/**
 * Shared `localStorage` key vocabulary for the web app.
 *
 * Two naming styles exist because the app grew them separately: namespaced
 * colon keys for global settings (`trusttrove:theme`, `trusttrove:display`,
 * `trusttrove:marketplace:filters`, …) and per-wallet underscore keys for
 * notification state (`trusttrove_prefs_<address>`,
 * `trusttrove_notifs_<address>`). Both styles are built here so a sweep that
 * means "everything the app owns" cannot silently miss a key written under the
 * other one (issue #1110).
 */

/** Namespace every key this app writes starts with. */
export const STORAGE_NAMESPACE = "trusttrove";

/**
 * Prefixes that mark a key as owned by this app. Colon-prefixed keys are global
 * settings, underscore-prefixed keys are scoped to a wallet address.
 */
export const STORAGE_KEY_PREFIXES = [
  `${STORAGE_NAMESPACE}:`,
  `${STORAGE_NAMESPACE}_`,
] as const;

/**
 * `localStorage` key holding one wallet's cached notification history.
 *
 * Notification *preferences* live under their own builder in
 * `lib/notification-preferences.ts`; this module only needs to know that both
 * are underscore keys so a sweep cannot miss either.
 *
 * @param address - The connected Stellar account address.
 * @returns The key `useNotifications` reads and writes history under.
 */
export function notificationHistoryKey(address: string): string {
  return `${STORAGE_NAMESPACE}_notifs_${address}`;
}

/**
 * Whether a key belongs to this app and is therefore in scope for a wipe.
 *
 * @param key - A `localStorage` key.
 * @returns `true` when the key carries one of {@link STORAGE_KEY_PREFIXES}.
 */
export function isAppStorageKey(key: string): boolean {
  return STORAGE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/**
 * Removes every key owned by the app from `localStorage`, leaving keys written
 * by other code on the same origin untouched.
 *
 * Enumerates through `length`/`key()` rather than `Object.keys(storage)`:
 * indexed access is the documented `Storage` interface, while own-property
 * enumeration is an accident of the browser implementation that this repo's
 * `localStorage` test double (`vitest.setup.ts`) does not reproduce.
 *
 * @returns The keys that were removed, in enumeration order.
 */
export function clearAppStorage(): string[] {
  const storage = window.localStorage;
  const owned: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && isAppStorageKey(key)) owned.push(key);
  }
  owned.forEach((key) => storage.removeItem(key));
  return owned;
}
