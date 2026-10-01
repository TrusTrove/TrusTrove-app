import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ConfirmationDialog } from "./ConfirmationDialog";
import { useConfirmDialogStore } from "@/store/confirmDialog";
import { useFocusTrap } from "@/hooks/useFocusTrap";

vi.mock("@/store/confirmDialog", () => ({
  useConfirmDialogStore: vi.fn(),
}));

vi.mock("@/hooks/useFocusTrap", () => ({
  useFocusTrap: vi.fn(() => ({ current: null })),
}));

describe("ConfirmationDialog", () => {
  it("renders non-null pendingAction happy path correctly", () => {
    const mockFn = vi.fn().mockResolvedValue(undefined);
    const mockCancel = vi.fn();

    vi.mocked(useConfirmDialogStore).mockReturnValue({
      pendingAction: {
        label: "Repay Debt",
        invoiceId: "invoice_123456789_long_hash",
        fn: mockFn,
      },
      cancel: mockCancel,
      request: vi.fn(),
    });

    render(<ConfirmationDialog />);

    // Verify it renders dialog title with action label
    expect(screen.getByText("Confirm Repay Debt")).toBeInTheDocument();

    // Verify invoice ID is truncated correctly: "invoic...hash"
    expect(screen.getByText("invoic...hash")).toBeInTheDocument();

    // Verify confirm button exists
    const confirmBtn = screen.getByRole("button", { name: /^confirm$/i });
    expect(confirmBtn).toBeInTheDocument();

    // Click confirm triggers fn and cancel
    fireEvent.click(confirmBtn);
    expect(mockCancel).toHaveBeenCalled();
    expect(mockFn).toHaveBeenCalled();
  });

  it("renders null edge case (returns null and doesn't display anything)", () => {
    vi.mocked(useConfirmDialogStore).mockReturnValue({
      pendingAction: null,
      cancel: vi.fn(),
      request: vi.fn(),
    });

    const { container } = render(<ConfirmationDialog />);
    expect(container.firstChild).toBeNull();
  });

  it("handles empty invoice ID edge case gracefully", () => {
    vi.mocked(useConfirmDialogStore).mockReturnValue({
      pendingAction: {
        label: "Fund Invoice",
        invoiceId: "",
        fn: vi.fn().mockResolvedValue(undefined),
      },
      cancel: vi.fn(),
      request: vi.fn(),
    });

    render(<ConfirmationDialog />);
    expect(screen.getByText("Confirm Fund Invoice")).toBeInTheDocument();
  });

  it("cancels when cancel button or close button is clicked", () => {
    const mockCancel = vi.fn();
    vi.mocked(useConfirmDialogStore).mockReturnValue({
      pendingAction: {
        label: "Ship Invoice",
        invoiceId: "invoice_abc",
        fn: vi.fn(),
      },
      cancel: mockCancel,
      request: vi.fn(),
    });

    render(<ConfirmationDialog />);

    // Click Close X button
    const closeBtn = screen.getByLabelText("Close confirmation dialog");
    fireEvent.click(closeBtn);
    expect(mockCancel).toHaveBeenCalledTimes(1);

    // Click Cancel button
    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelBtn);
    expect(mockCancel).toHaveBeenCalledTimes(2);
  });

  it("cancels when clicking the overlay backdrop", () => {
    const mockCancel = vi.fn();
    vi.mocked(useConfirmDialogStore).mockReturnValue({
      pendingAction: {
        label: "Default Invoice",
        invoiceId: "invoice_def",
        fn: vi.fn(),
      },
      cancel: mockCancel,
      request: vi.fn(),
    });

    render(<ConfirmationDialog />);

    // Click dialog overlay backdrop
    const dialogRoot = screen.getByRole("dialog");
    fireEvent.click(dialogRoot);
    expect(mockCancel).toHaveBeenCalled();
  });
});
