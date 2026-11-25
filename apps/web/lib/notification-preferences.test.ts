import { beforeEach, describe, expect, it } from "vitest";
import {
  NOTIFICATION_CATEGORIES,
  prefsStorageKey,
  readStoredPrefs,
} from "@/lib/notification-preferences";

describe("notification preference storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("scopes the key to the wallet address", () => {
    expect(prefsStorageKey("GABC")).toBe("trusttrove_prefs_GABC");
    expect(prefsStorageKey("GXYZ")).not.toBe(prefsStorageKey("GABC"));
  });

  it("defaults every category to enabled when nothing is stored", () => {
    const prefs = readStoredPrefs(prefsStorageKey("GNEW"));

    for (const category of NOTIFICATION_CATEGORIES) {
      expect(prefs[category]).toBe(true);
    }
  });

  it("returns the stored map for the requested key only", () => {
    localStorage.setItem(prefsStorageKey("GA"), '{"Invoice Funded": false}');

    expect(readStoredPrefs(prefsStorageKey("GA"))).toEqual({
      "Invoice Funded": false,
    });
    // A different wallet starts from the documented defaults, not from GA's
    // saved state.
    expect(readStoredPrefs(prefsStorageKey("GB"))["Invoice Funded"]).toBe(true);
  });

  it("falls back to the defaults when the stored value cannot be parsed", () => {
    const key = prefsStorageKey("GBROKEN");
    localStorage.setItem(key, "not json");

    expect(readStoredPrefs(key)["Invoice Repaid"]).toBe(true);
  });
});
