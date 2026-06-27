'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchInterval: 5000, // Sync with indexer polling interval
            staleTime: 4000,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#0d131a',
            border: '1px solid #1a2330',
            color: '#e2e8f0',
            fontFamily: 'ui-monospace, monospace',
          },
        }}
      />
    </QueryClientProvider>
  );
}
