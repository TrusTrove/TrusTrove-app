"use client";

import React, { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  MUTATION_RETRY_DISABLED,
  retryTransientQuery,
  transientRetryDelayMs,
} from "@/lib/retry";
import { Toaster } from "sonner";
import { ConfirmationDialog } from "@/components/shared/ConfirmationDialog";
import { ConfigBanner } from "@/components/shared/ConfigBanner";
import { useTheme } from "@/hooks/useTheme";
import { MotionConfig } from "framer-motion";
// Startup wiring of the SDK to the web app's NEXT_PUBLIC_* config.
import "@/lib/sdkConfig";

export default function Providers({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 4000,
            // Reads are side-effect free, so a transient 429/502/503/504 or a
            // dropped connection is retried with bounded exponential backoff
            // (issue #639). This replaces react-query's unconditional
            // `retry: 3`, so permanent 4xx failures now surface immediately.
            retry: retryTransientQuery,
            retryDelay: (failureCount: number) =>
              transientRetryDelayMs(failureCount),
          },
          mutations: {
            // FINANCIAL SAFETY (issue #639): never retry a mutation
            // automatically. A lost response does not prove a money-moving
            // transaction failed, so a replay can double a deposit,
            // withdrawal or repayment. This is react-query's default already;
            // it is stated explicitly so the guarantee is greppable and
            // cannot be lost by accident. See apps/web/lib/retry.ts.
            retry: MUTATION_RETRY_DISABLED,
          },
        },
      }),
  );

  useEffect(() => {
    (
      window as Window & { __reactQueryClient?: QueryClient }
    ).__reactQueryClient = queryClient;
  }, [queryClient]);

  return (
    <MotionConfig reducedMotion="user">
      <QueryClientProvider client={queryClient}>
        <ConfigBanner />
        {children}
        <ConfirmationDialog />
        <Toaster
          containerAriaLabel="Notifications"
          position="bottom-right"
          theme={theme}
          toastOptions={{
            style: {
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              color: "hsl(var(--card-foreground))",
              fontFamily: "ui-monospace, monospace",
            },
          }}
        />
      </QueryClientProvider>
    </MotionConfig>
  );
}
