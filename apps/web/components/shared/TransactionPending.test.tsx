import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TransactionPending } from "./TransactionPending";

describe("TransactionPending", () => {
  it("renders loading state correctly", () => {
    render(
      <TransactionPending
        isOpen={true}
        txHash="0x123"
        statusText="Processing... Please wait"
      />,
    );
    expect(screen.getByText(/Processing... Please wait/i)).toBeInTheDocument();
    expect(screen.getByText(/TRANSACTION SIGNED/i)).toBeInTheDocument();
    expect(screen.getByText(/0x123/i)).toBeInTheDocument();
  });

  it("renders empty state correctly (not pending)", () => {
    const { container } = render(
      <TransactionPending isOpen={false} txHash={null} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("does not throw when dismissed after timeout with no onClose (#1098)", () => {
    vi.useFakeTimers();
    try {
      const { container } = render(
        <TransactionPending isOpen={true} txHash={null} />,
      );

      // Advance past the 60s timeout: canDismiss must stay false without onClose.
      act(() => {
        vi.advanceTimersByTime(60_000);
      });

      const backdrop = container.firstChild as HTMLElement;
      expect(() =>
        fireEvent.keyDown(backdrop, { key: "Escape" }),
      ).not.toThrow();
      expect(() => fireEvent.click(backdrop)).not.toThrow();
    } finally {
      vi.useRealTimers();
    }
  });

  it("allows dismissal after timeout only when onClose exists (#1098)", () => {
    vi.useFakeTimers();
    try {
      const onClose = vi.fn();
      const { container } = render(
        <TransactionPending isOpen={true} txHash={null} onClose={onClose} />,
      );

      act(() => {
        vi.advanceTimersByTime(60_000);
      });

      const backdrop = container.firstChild as HTMLElement;

      // Escape dismisses once the timeout has elapsed.
      fireEvent.keyDown(backdrop, { key: "Escape" });
      expect(onClose).toHaveBeenCalled();
      onClose.mockClear();

      // Backdrop click dismisses as well.
      fireEvent.click(backdrop);
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
