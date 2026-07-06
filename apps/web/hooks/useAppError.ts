import { useState, useCallback } from "react";

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "An error occurred";
}

export function useAppError() {
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const handleError = useCallback(
    (err: unknown, fallback?: string) => {
      setError(getErrorMessage(err) || fallback || "An error occurred");
    },
    [],
  );

  return { error, setError, clearError, handleError };
}
