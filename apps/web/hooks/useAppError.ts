import { useState, useCallback } from "react";
import { getUserFriendlyMessage } from "@/lib/errors";

export function useAppError() {
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const handleError = useCallback((err: unknown, fallback?: string) => {
    setError(getUserFriendlyMessage(err) || fallback || "An error occurred");
  }, []);

  return { error, setError, clearError, handleError };
}
