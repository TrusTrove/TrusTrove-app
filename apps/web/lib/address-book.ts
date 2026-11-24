import { addressBookKey } from "./storage";

export interface AddressBookEntry {
  address: string;
  alias: string;
  updatedAt: number;
}

export function getAddressBook(address?: string | null): Record<string, string> {
  if (!address || typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(addressBookKey(address));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const result: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "string") {
          result[k] = v;
        }
      }
      return result;
    }
  } catch {
    // fallback
  }
  return {};
}

export function setAddressAlias(address: string, targetAddress: string, alias: string): Record<string, string> {
  if (!address || typeof window === "undefined") return {};
  const current = getAddressBook(address);
  const trimmed = alias.trim();
  const next = { ...current };
  if (trimmed === "") {
    delete next[targetAddress];
  } else {
    next[targetAddress] = trimmed;
  }
  try {
    window.localStorage.setItem(addressBookKey(address), JSON.stringify(next));
  } catch {
    // storage error
  }
  return next;
}

export function removeAddressAlias(address: string, targetAddress: string): Record<string, string> {
  return setAddressAlias(address, targetAddress, "");
}

export function resolveAddressAlias(address: string | null | undefined, targetAddress: string): string {
  if (!address) return targetAddress;
  const book = getAddressBook(address);
  return book[targetAddress] || targetAddress;
}
