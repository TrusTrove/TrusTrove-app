import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TransactionPending } from "@/components/shared/TransactionPending";

describe("Regression: Focus trap and ARIA attributes on modals (PR #126)", () => {
  it("renders with role='dialog' and aria-modal='true'", () => {
    render(
      <TransactionPending isOpen={true} txHash={null} />,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-label", "Transaction Pending");
    expect(dialog).toHaveAttribute("tabindex", "-1");
  });

  it("has a focusable element inside the dialog", () => {
    render(
      <TransactionPending isOpen={true} txHash="0xtx" onClose={vi.fn()} />,
    );

    const closeButton = screen.getByText(/close dialog/i);
    expect(closeButton).toBeInTheDocument();
  });
});
