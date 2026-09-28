"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_THEME,
  Theme,
  THEME_STORAGE_KEY,
  applyTheme,
  getSystemTheme,
  readStoredTheme,
  resolveInitialTheme,
  storeTheme,
} from "@/lib/theme";

/**
 * Custom hook that exposes the active colour theme and lets callers change it.
 *
 * The theme itself is applied before paint by the bootstrap script in
 * `apps/web/app/layout.tsx`; this hook syncs React state to whatever that
 * script decided (during the first effect, so SSR and hydration both start
 * from {@link DEFAULT_THEME} and never mismatch), persists explicit choices to
 * `localStorage`, and keeps following the OS preference until the user makes
 * one.
 *
 * @returns An object containing:
 *   - `theme` — the active `Theme` (`"dark"` until mounted).
 *   - `mounted` — `false` on the server and the first client render, `true`
 *     once `theme` reflects the real document state.
 *   - `setTheme` — persist and apply a specific theme.
 *   - `toggleTheme` — flip between light and dark.
 *
 * @example
 * ```tsx
 * const { theme, toggleTheme } = useTheme();
 * <button onClick={toggleTheme}>{theme === "dark" ? "☀" : "☾"}</button>;
 * ```
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);
  const [mounted, setMounted] = useState(false);

  // Adopt the pre-paint decision after hydration so the first client render
  // matches the server-rendered markup exactly.
  useEffect(() => {
    const initial = resolveInitialTheme();
    setThemeState(initial);
    applyTheme(initial);
    setMounted(true);
  }, []);

  // Follow the OS preference for as long as the user has not chosen a theme.
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;

    const query = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      if (readStoredTheme() !== null) return;
      const next = getSystemTheme();
      setThemeState(next);
      applyTheme(next);
    };

    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, []);

  // Mirror the choice across tabs.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== THEME_STORAGE_KEY) return;
      const next = resolveInitialTheme();
      setThemeState(next);
      applyTheme(next);
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    storeTheme(next);
    applyTheme(next);
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(
      (document.documentElement.classList.contains("dark")
        ? "light"
        : "dark") as Theme,
    );
  }, [setTheme]);

  return { theme, mounted, setTheme, toggleTheme };
}
