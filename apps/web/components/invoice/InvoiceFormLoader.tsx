"use client";

import React from "react";

// `dynamic()`'s `loading` option in app/dashboard/page.tsx is declared at module
// scope, so the fallback lives here where tests can render it directly.
export function InvoiceFormLoader() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="h-64 w-full flex items-center justify-center"
    >
      <div
        aria-hidden="true"
        className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"
      />
      <span className="sr-only">Loading invoice form</span>
    </div>
  );
}
