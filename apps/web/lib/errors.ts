const KNOWN_ERRORS: Record<string, string> = {
  "Wallet not connected":
    "Please connect your wallet to perform this action",
};

export function getErrorMessage(
  error: unknown,
  fallback = "An unexpected error occurred",
): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as any).message === "string"
  ) {
    return (error as any).message;
  }
  return fallback;
}

export function getUserFriendlyMessage(error: unknown): string {
  const message = getErrorMessage(error);
  return KNOWN_ERRORS[message] || message;
}
