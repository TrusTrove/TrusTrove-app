import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { NotificationBell } from "./NotificationBell";

describe("NotificationBell", () => {
  it("renders unread badge and handles opening correctly", () => {
    const onOpen = vi.fn();
    const notifications = [
      {
        id: "1",
        type: "InvoiceCreated",
        invoiceId: "inv_1",
        message: "Invoice created",
        timestamp: Date.now(),
        read: false,
      },
      {
        id: "2",
        type: "InvoiceFunded",
        invoiceId: "inv_2",
        message: "Invoice funded",
        timestamp: Date.now(),
        read: false,
      },
    ];

    render(<NotificationBell notifications={notifications} onOpen={onOpen} />);

    const bellButton = screen.getByRole("button", { name: "Notifications" });
    expect(bellButton).toBeInTheDocument();

    fireEvent.click(bellButton);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.getByText("2 new")).toBeInTheDocument();
  });
});
