/**
 * Theme primitives shared by the pre-paint bootstrap script, the
 * {@link useTheme} hook and the ThemeToggle control.
 *
 * The app ships two palettes as CSS custom properties in
 * `apps/web/app/globals.css`: light under `:root` and dark under `.dark`.
 * Switching themes therefore means nothing more than adding or removing the
 * `dark` class on `<html>`.
 */

/** The two themes the app ships palettes for. */
export type Theme = "light" | "dark";

/** `localStorage` key holding the user's explicit choice, if they made one. */
export const THEME_STORAGE_KEY = "trusttrove:theme";

/**
 * Theme rendered by the server in `apps/web/app/layout.tsx`. The bootstrap
 * script corrects it before first paint when the visitor prefers the other
 * one, so this is only what a JavaScript-less visitor ends up with.
 */
export const DEFAULT_THEME: Theme = "dark";

function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

/**
 * Reads the persisted theme preference.
 *
 * @returns The stored `Theme`, or `null` when nothing valid is stored (or when
 *   `localStorage` is unavailable, e.g. Safari private mode).
 */
export function readStoredTheme(): Theme | null {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : null;
  } catch {
    return null;
  }
}

/**
 * Persists a theme preference, ignoring storage failures.
 *
 * @param theme - The theme the user selected.
 */
export function storeTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage disabled — the in-memory theme still applies for this session.
  }
}

/**
 * Reads the OS-level colour scheme preference.
 *
 * @returns `"dark"` or `"light"` from `prefers-color-scheme`, falling back to
 *   {@link DEFAULT_THEME} when `matchMedia` is unavailable.
 */
export function getSystemTheme(): Theme {
  try {
    if (typeof window.matchMedia !== "function") return DEFAULT_THEME;
    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  } catch {
    return DEFAULT_THEME;
  }
}

/**
 * Resolves the theme to apply on load: an explicit saved preference wins,
 * otherwise the OS preference.
 *
 * @returns The `Theme` that should be active.
 */
export function resolveInitialTheme(): Theme {
  return readStoredTheme() ?? getSystemTheme();
}

/**
 * Applies a theme to the document by toggling the `dark` class on `<html>` and
 * setting `color-scheme` so native widgets (scrollbars, form controls) match.
 *
 * @param theme - The theme to apply.
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

/**
 * Inline script injected into `<head>` so the correct theme is applied before
 * first paint, avoiding a flash of the server-rendered default.
 *
 * Kept as a self-contained string (no imports, no optional chaining) because
 * it runs as a classic blocking script ahead of any bundle.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var k=${JSON.stringify(
  THEME_STORAGE_KEY,
)};var s=null;try{s=window.localStorage.getItem(k)}catch(e){}var t=(s==="light"||s==="dark")?s:(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");var r=document.documentElement;if(t==="dark"){r.classList.add("dark")}else{r.classList.remove("dark")}r.style.colorScheme=t}catch(e){}})();`;
