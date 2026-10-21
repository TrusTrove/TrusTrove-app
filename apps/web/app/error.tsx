"use client";

import { useEffect } from "react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[RootError]", error);
  }, [error]);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-[60vh] flex-col items-center justify-center bg-background px-4 text-center text-foreground focus:outline-none"
    >
      <div
        role="alert"
        aria-live="assertive"
        className="flex flex-col items-center justify-center gap-4"
      >
        <h1 className="text-lg font-semibold text-destructive">
          Something went wrong.
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          {error.message ||
            "An unexpected error occurred while loading this page."}
        </p>
        <button
          onClick={reset}
          className="rounded-md border border-border px-4 py-2 text-sm text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
