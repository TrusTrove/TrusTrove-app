import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  DEFAULT_THEME,
  THEME_BOOTSTRAP_SCRIPT,
  THEME_STORAGE_KEY,
  applyTheme,
  getSystemTheme,
  readStoredTheme,
  resolveInitialTheme,
  storeTheme,
} from "./theme";

function mockMatchMedia(prefersLight: boolean) {
  const listeners: Array<() => void> = [];
  const mm = vi.fn((query: string) => ({
    matches: query.includes("light") ? prefersLight : !prefersLight,
    media: query,
    addEventListener: (_: string, cb: () => void) => listeners.push(cb),
    removeEventListener: () => {},
  }));
  Object.defineProperty(window, "matchMedia", {
    value: mm,
    writable: true,
    configurable: true,
  });
  return { mm, listeners };
}

describe("theme storage helpers", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.style.colorScheme = "";
  });

  it("reads back a stored theme", () => {
    storeTheme("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(readStoredTheme()).toBe("light");
  });

  it("returns null when nothing is stored", () => {
    expect(readStoredTheme()).toBeNull();
  });

  it("ignores a garbage stored value", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "solarized");
    expect(readStoredTheme()).toBeNull();
  });

  it("swallows localStorage failures in both directions", () => {
    const original = window.localStorage;
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: () => {
          throw new Error("denied");
        },
        setItem: () => {
          throw new Error("denied");
        },
      },
      writable: true,
      configurable: true,
    });

    expect(readStoredTheme()).toBeNull();
    expect(() => storeTheme("dark")).not.toThrow();

    Object.defineProperty(window, "localStorage", {
      value: original,
      writable: true,
      configurable: true,
    });
  });
});

describe("applyTheme", () => {
  beforeEach(() => {
    document.documentElement.className = "";
  });

  it("adds the dark class and color-scheme for dark", () => {
    applyTheme("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("removes the dark class for light", () => {
    document.documentElement.classList.add("dark");
    applyTheme("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe("light");
  });
});

describe("getSystemTheme / resolveInitialTheme", () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    localStorage.clear();
  });

  afterEach(() => {
    Object.defineProperty(window, "matchMedia", {
      value: originalMatchMedia,
      writable: true,
      configurable: true,
    });
  });

  it("reports light when the OS prefers light", () => {
    mockMatchMedia(true);
    expect(getSystemTheme()).toBe("light");
  });

  it("reports dark when the OS prefers dark", () => {
    mockMatchMedia(false);
    expect(getSystemTheme()).toBe("dark");
  });

  it("falls back to the default theme without matchMedia", () => {
    Object.defineProperty(window, "matchMedia", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    expect(getSystemTheme()).toBe(DEFAULT_THEME);
  });

  it("prefers a saved choice over the OS preference", () => {
    mockMatchMedia(true);
    storeTheme("dark");
    expect(resolveInitialTheme()).toBe("dark");
  });

  it("falls back to the OS preference with no saved choice", () => {
    mockMatchMedia(true);
    expect(resolveInitialTheme()).toBe("light");
  });
});

describe("THEME_BOOTSTRAP_SCRIPT", () => {
  beforeEach(() => {
    document.documentElement.className = "";
    document.documentElement.style.colorScheme = "";
    localStorage.clear();
  });

  it("applies a stored light preference before paint", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    document.documentElement.classList.add("dark");

    new Function(THEME_BOOTSTRAP_SCRIPT)();

    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe("light");
  });

  it("keeps the dark class for a stored dark preference", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");

    new Function(THEME_BOOTSTRAP_SCRIPT)();

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("references the same storage key the hook writes", () => {
    expect(THEME_BOOTSTRAP_SCRIPT).toContain(THEME_STORAGE_KEY);
  });

  it("never throws, even with storage and matchMedia broken", () => {
    const original = window.localStorage;
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: () => {
          throw new Error("denied");
        },
      },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, "matchMedia", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    expect(() => new Function(THEME_BOOTSTRAP_SCRIPT)()).not.toThrow();

    Object.defineProperty(window, "localStorage", {
      value: original,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, "matchMedia", {
      value: originalMatchMedia,
      writable: true,
      configurable: true,
    });
  });
});
