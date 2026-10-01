import { useState, useCallback } from "react";
import { getUserFriendlyMessage } from "@/lib/errors";

/**
 * Custom hook for managing inline error state in components.
 *
 * Wraps React `useState` with a convenience `handleError` helper that
 * converts arbitrary caught values (strings, `Error` objects, unknown)
 * into user-friendly messages via `getUserFriendlyMessage`.
 *
 * @returns An object containing:
 *   - `error` — Current error message string, or `null` if no error.
 *   - `setError` — Raw setter for the error state (`string | null`).
 *   - `clearError` — Resets the error state to `null`.
 *   - `handleError` — Accepts an unknown caught value and an optional
 *     fallback message, then sets the user-friendly error string.
 *
 * @example
 * ```ts
 * const { error, handleError, clearError } = useAppError();
 *
 * // Inside a mutation onError:
 * onError: (err) => handleError(err, "Deposit failed");
 *
 * // Clear on retry:
 * clearError();
 * ```
 */
export function useAppError() {
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const handleError = useCallback((err: unknown, fallback?: string) => {
    setError(getUserFriendlyMessage(err) || fallback || "An error occurred");
  }, []);

  return { error, setError, clearError, handleError };
}
