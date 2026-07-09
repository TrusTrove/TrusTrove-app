import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TransactionPending } from "@/components/shared/TransactionPending";

describe("Regression: TransactionPending modal dismissal (issue #138)", () => {
  it("allows backdrop click to dismiss only when txHash is present", () => {
    const onClose = vi.fn();

    const { container } = render(
      <TransactionPending isOpen={true} txHash="0xtx" onClose={onClose} />,
    );

    const backdrop = container.firstChild as HTMLElement;
    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does NOT allow backdrop click to dismiss when txHash is null", () => {
    const onClose = vi.fn();

    const { container } = render(
      <TransactionPending isOpen={true} txHash={null} onClose={onClose} />,
    );

    const backdrop = container.firstChild as HTMLElement;
    fireEvent.click(backdrop);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose when Escape key is pressed on backdrop and txHash present", () => {
    const onClose = vi.fn();

    const { container } = render(
      <TransactionPending isOpen={true} txHash="0xtx" onClose={onClose} />,
    );

    const backdrop = container.firstChild as HTMLElement;
    fireEvent.keyDown(backdrop, { key: "Escape" });

    expect(onClose).toHaveBeenCalled();
  });

  it("shows close button only when onClose is provided", () => {
    const { rerender } = render(
      <TransactionPending isOpen={true} txHash="0xtx" />,
    );

    expect(screen.queryByText(/close dialog/i)).not.toBeInTheDocument();

    rerender(
      <TransactionPending isOpen={true} txHash="0xtx" onClose={vi.fn()} />,
    );

    expect(screen.getByText(/close dialog/i)).toBeInTheDocument();
  });

  it("does not render anything when isOpen is false", () => {
    const { container } = render(
      <TransactionPending isOpen={false} txHash={null} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
