"use client";

import React, { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { ConfirmationDialog } from "@/components/shared/ConfirmationDialog";
import { ConfigBanner } from "@/components/shared/ConfigBanner";
import { useTheme } from "@/hooks/useTheme";
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
  );
}
