"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black px-4 text-center">
          <h2 className="text-lg font-semibold text-red-400">
            The app crashed.
          </h2>
          <p className="max-w-md text-sm text-zinc-400">
            {error.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={reset}
            className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-200"
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}