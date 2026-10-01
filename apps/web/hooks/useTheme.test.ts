import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useTheme } from "./useTheme";
import { THEME_STORAGE_KEY } from "@/lib/theme";

type MediaListener = (event: MediaQueryListEvent) => void;

function installMatchMedia(prefersLight: boolean) {
  const listeners: MediaListener[] = [];
  Object.defineProperty(window, "matchMedia", {
    value: (query: string) => ({
      matches: query.includes("light") ? prefersLight : !prefersLight,
      media: query,
      addEventListener: (_: string, cb: MediaListener) => listeners.push(cb),
      removeEventListener: (_: string, cb: MediaListener) => {
        const i = listeners.indexOf(cb);
        if (i >= 0) listeners.splice(i, 1);
      },
    }),
    writable: true,
    configurable: true,
  });
  return listeners;
}

describe("useTheme", () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    localStorage.clear();
    document.documentElement.className = "dark";
    document.documentElement.style.colorScheme = "";
  });

  afterEach(() => {
    Object.defineProperty(window, "matchMedia", {
      value: originalMatchMedia,
      writable: true,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  it("adopts the saved preference on mount", async () => {
    installMatchMedia(false);
    localStorage.setItem(THEME_STORAGE_KEY, "light");

    const { result } = renderHook(() => useTheme());

    await waitFor(() => expect(result.current.mounted).toBe(true));
    expect(result.current.theme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("falls back to the OS preference when nothing is saved", async () => {
    installMatchMedia(true);

    const { result } = renderHook(() => useTheme());

    await waitFor(() => expect(result.current.theme).toBe("light"));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it("toggles, applies and persists the new theme", async () => {
    installMatchMedia(false);

    const { result } = renderHook(() => useTheme());
    await waitFor(() => expect(result.current.theme).toBe("dark"));

    act(() => result.current.toggleTheme());

    expect(result.current.theme).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    act(() => result.current.toggleTheme());

    expect(result.current.theme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("setTheme applies a specific theme", async () => {
    installMatchMedia(false);

    const { result } = renderHook(() => useTheme());
    await waitFor(() => expect(result.current.mounted).toBe(true));

    act(() => result.current.setTheme("light"));
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(result.current.theme).toBe("light");
  });

  it("follows OS changes only while no explicit choice is saved", async () => {
    let listeners = installMatchMedia(false);

    const { result, unmount } = renderHook(() => useTheme());
    await waitFor(() => expect(result.current.theme).toBe("dark"));

    // OS flips to light, user has not chosen → follow it.
    installMatchMedia(true);
    act(() => listeners.forEach((cb) => cb({} as MediaQueryListEvent)));
    expect(result.current.theme).toBe("light");

    unmount();

    // With an explicit choice saved, OS changes are ignored.
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    listeners = installMatchMedia(false);
    const second = renderHook(() => useTheme());
    await waitFor(() => expect(second.result.current.theme).toBe("dark"));

    installMatchMedia(true);
    act(() => listeners.forEach((cb) => cb({} as MediaQueryListEvent)));
    expect(second.result.current.theme).toBe("dark");
  });

  it("syncs a choice made in another tab", async () => {
    installMatchMedia(false);

    const { result } = renderHook(() => useTheme());
    await waitFor(() => expect(result.current.theme).toBe("dark"));

    localStorage.setItem(THEME_STORAGE_KEY, "light");
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: THEME_STORAGE_KEY }),
      );
    });

    expect(result.current.theme).toBe("light");
  });

  it("does not crash when matchMedia is unavailable", async () => {
    Object.defineProperty(window, "matchMedia", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useTheme());

    await waitFor(() => expect(result.current.mounted).toBe(true));
    expect(result.current.theme).toBe("dark");
  });
});
