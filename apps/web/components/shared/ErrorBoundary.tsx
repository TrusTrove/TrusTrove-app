"use client";

import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
  context?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

function logError(error: Error, context?: string, info?: React.ErrorInfo) {
  console.error(`[ErrorBoundary${context ? `:${context}` : ""}]`, error, info);
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logError(error, this.props.context, info);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return (
        <DefaultErrorFallback error={this.state.error} reset={this.reset} />
      );
    }
    return this.props.children;
  }
}

function DefaultErrorFallback({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-red-900/40 bg-red-950/20 p-6 text-center">
      <p className="text-sm font-medium text-red-400">
        Something went wrong loading this.
      </p>
      <p className="max-w-sm text-xs text-red-400/70">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        onClick={reset}
        className="rounded-md border border-red-700 px-3 py-1.5 text-xs text-red-300 transition hover:bg-red-900/30"
      >
        Try again
      </button>
    </div>
  );
}
