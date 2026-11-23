import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmationDialog } from "../ConfirmationDialog";
import { useConfirmDialogStore } from "@store/confirmDialog";
import { useWallet } from "@hooks/useWallet";

jest.mock("@store/confirmDialog");
jest.mock("@hooks/useWallet");

describe("ConfirmationDialog", () => {
  const mockCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useConfirmDialogStore as unknown as jest.Mock).mockReturnValue({
      pendingAction: {
        label: "Test Action",
        invoiceId: "inv-123",
        fn: jest.fn(),
      },
      cancel: mockCancel,
    });
  });

  it("renders recovery path and blocks confirmation when wallet cannot sign", () => {
    (useWallet as unknown as jest.Mock).mockReturnValue({
      connected: false,
      canSign: false,
      connectWallet: jest.fn(),
      error: null,
    });

    render(<ConfirmationDialog />);

    expect(screen.getByText(/Confirm Test Action/i)).toBeDefined();
    expect(screen.getByText(/Your wallet is not connected/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /Connect Wallet/i })).toBeDefined();
    expect(screen.queryByRole("button", { name: /^CONFIRM$/i })).toBeNull();
  });

  it("renders confirm button when wallet can sign successfully", () => {
    (useWallet as unknown as jest.Mock).mockReturnValue({
      connected: true,
      canSign: true,
      connectWallet: jest.fn(),
      error: null,
    });

    render(<ConfirmationDialog />);

    expect(screen.getByRole("button", { name: /^CONFIRM$/i })).toBeDefined();
  });
});
