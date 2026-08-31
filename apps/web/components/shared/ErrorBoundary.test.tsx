import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Child failed");
  }

  return <p>Child content</p>;
}

describe("ErrorBoundary", () => {
  it("renders its children by default", () => {
    render(
      <ErrorBoundary>
        <p>Child content</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("renders the default fallback and resets after clicking Try again", () => {
    function ResettableChild() {
      const [shouldThrow, setShouldThrow] = useState(false);

      return (
        <>
          <button onClick={() => setShouldThrow(true)}>Cause error</button>
          <ThrowingChild shouldThrow={shouldThrow} />
        </>
      );
    }

    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const windowConsoleError = vi
      .spyOn(window.console, "error")
      .mockImplementation(() => {});
    try {
      render(
        <ErrorBoundary>
          <ResettableChild />
        </ErrorBoundary>,
      );

      fireEvent.click(screen.getByRole("button", { name: "Cause error" }));

      expect(
        screen.getByText("Something went wrong loading this."),
      ).toBeInTheDocument();
      expect(screen.getByText("Child failed")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Try again" }));

      expect(
        screen.getByRole("button", { name: "Cause error" }),
      ).toBeInTheDocument();
      expect(screen.getByText("Child content")).toBeInTheDocument();
    } finally {
      consoleError.mockRestore();
      windowConsoleError.mockRestore();
    }
  });

  it("uses the custom fallback with the error and reset callback", () => {
    const fallback = vi.fn((error: Error, reset: () => void) => (
      <div>
        <p>Custom fallback: {error.message}</p>
        <button onClick={reset}>Reset boundary</button>
      </div>
    ));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const windowConsoleError = vi
      .spyOn(window.console, "error")
      .mockImplementation(() => {});

    try {
      render(
        <ErrorBoundary fallback={fallback} context="test">
          <ThrowingChild shouldThrow={true} />
        </ErrorBoundary>,
      );

      expect(
        screen.getByText("Custom fallback: Child failed"),
      ).toBeInTheDocument();
      expect(fallback).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Child failed" }),
        expect.any(Function),
      );

      fireEvent.click(screen.getByRole("button", { name: "Reset boundary" }));
      expect(
        screen.getByText("Custom fallback: Child failed"),
      ).toBeInTheDocument();
      expect(fallback).toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
      windowConsoleError.mockRestore();
    }
  });
});
