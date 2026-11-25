import { beforeEach, describe, expect, it } from "vitest";
import {
  STORAGE_KEY_PREFIXES,
  clearAppStorage,
  isAppStorageKey,
  notificationHistoryKey,
} from "./storage";
import { prefsStorageKey } from "./notification-preferences";

const ADDRESS = "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB";

describe("notification key builders", () => {
  it("builds the per-wallet keys the pipeline has always used", () => {
    // These exact strings are persisted in existing users' browsers (and are
    // what e2e/notifications.spec.ts documents), so the builders must not
    // change the shape — only centralise it.
    expect(prefsStorageKey(ADDRESS)).toBe(`trusttrove_prefs_${ADDRESS}`);
    expect(notificationHistoryKey(ADDRESS)).toBe(
      `trusttrove_notifs_${ADDRESS}`,
    );
  });
});

describe("isAppStorageKey", () => {
  it("covers both the colon and the underscore naming style", () => {
    expect([...STORAGE_KEY_PREFIXES]).toEqual(["trusttrove:", "trusttrove_"]);
    expect(isAppStorageKey("trusttrove:theme")).toBe(true);
    expect(isAppStorageKey(prefsStorageKey(ADDRESS))).toBe(true);
    expect(isAppStorageKey(notificationHistoryKey(ADDRESS))).toBe(true);
  });

  it("leaves keys this app does not own alone", () => {
    expect(isAppStorageKey("theme")).toBe(false);
    expect(isAppStorageKey("otherapp:theme")).toBe(false);
    expect(isAppStorageKey("trusttrove")).toBe(false);
  });
});

describe("clearAppStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("removes notification state as well as settings keys", () => {
    localStorage.setItem("trusttrove:theme", "dark");
    localStorage.setItem("trusttrove:display", '{"density":"compact"}');
    localStorage.setItem("trusttrove:marketplace:filters", "{}");
    localStorage.setItem(prefsStorageKey(ADDRESS), '{"Invoice Listed":false}');
    localStorage.setItem(notificationHistoryKey(ADDRESS), "[]");

    const removed = clearAppStorage().sort();

    expect(removed).toEqual(
      [
        "trusttrove:theme",
        "trusttrove:display",
        "trusttrove:marketplace:filters",
        prefsStorageKey(ADDRESS),
        notificationHistoryKey(ADDRESS),
      ].sort(),
    );
    expect(localStorage.length).toBe(0);
  });

  it("keeps keys written by other code on the same origin", () => {
    localStorage.setItem("theme", "light");
    localStorage.setItem(prefsStorageKey(ADDRESS), "{}");

    clearAppStorage();

    expect(localStorage.getItem("theme")).toBe("light");
    expect(localStorage.getItem(prefsStorageKey(ADDRESS))).toBeNull();
  });
});
