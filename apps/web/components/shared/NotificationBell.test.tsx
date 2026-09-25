import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NotificationBell } from "./NotificationBell";

describe("NotificationBell", () => {
  it("renders empty state", () => {
    render(<NotificationBell notifications={[]} />);
    const button = screen.getByRole("button", { name: /notifications/i });
    expect(button).toBeDefined();

    fireEvent.click(button);
    expect(screen.getByText("No notifications yet")).toBeDefined();
  });

  it("renders unread count and items", () => {
    const mockNotifs = [
      {
        id: "1",
        type: "Invoice Created",
        invoiceId: "inv1",
        message: "New invoice",
        timestamp: Date.now() / 1000 - 120, // 2m ago
        read: false,
      },
    ];

    render(<NotificationBell notifications={mockNotifs} />);

    // Open dropdown
    const button = screen.getByRole("button", { name: /notifications/i });
    fireEvent.click(button);

    // Check count and content
    expect(screen.getByText("1 new")).toBeDefined();
    expect(screen.getByText("Invoice Created")).toBeDefined();
    expect(screen.getByText("New invoice")).toBeDefined();
    expect(screen.getByText(/m ago/)).toBeDefined();
  });

  it("calls onOpen when opened", () => {
    const onOpen = vi.fn();
    render(<NotificationBell notifications={[]} onOpen={onOpen} />);

    const button = screen.getByRole("button", { name: /notifications/i });
    fireEvent.click(button);

    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
