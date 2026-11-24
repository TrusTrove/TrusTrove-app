import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConfirmationDialog } from "../ConfirmationDialog";
import { useConfirmDialogStore } from "@/store/confirmDialog";
import { useWallet } from "@/hooks/useWallet";

vi.mock("@/store/confirmDialog");
vi.mock("@/hooks/useWallet");

describe("ConfirmationDialog", () => {
  const mockCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (
      useConfirmDialogStore as unknown as ReturnType<typeof vi.fn>
    ).mockReturnValue({
      pendingAction: {
        label: "Test Action",
        invoiceId: "inv-123",
        fn: vi.fn(),
      },
      cancel: mockCancel,
    });
  });

  it("renders recovery path and blocks confirmation when wallet cannot sign", () => {
    (useWallet as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      connected: false,
      canSign: false,
      connectWallet: vi.fn(),
      error: null,
    });

    render(<ConfirmationDialog />);

    expect(screen.getByText(/Confirm Test Action/i)).toBeDefined();
    expect(screen.getByText(/Your wallet is not connected/i)).toBeDefined();
    expect(
      screen.getByRole("button", { name: /Connect Wallet/i }),
    ).toBeDefined();
    expect(screen.queryByRole("button", { name: /^CONFIRM$/i })).toBeNull();
  });

  it("renders confirm button when wallet can sign successfully", async () => {
    (useWallet as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      connected: true,
      canSign: true,
      connectWallet: vi.fn(),
      error: null,
    });

    render(<ConfirmationDialog />);

    expect(screen.getByRole("button", { name: /^CONFIRM$/i })).toBeDefined();
  });
});
