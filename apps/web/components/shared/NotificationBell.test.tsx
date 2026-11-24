import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotificationBell } from "./NotificationBell";
import * as useNotificationsModule from "../../hooks/useNotifications";

vi.mock("../../hooks/useNotifications", () => ({
  useNotifications: vi.fn(),
}));

describe("NotificationBell activity filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders notification bell and filters by category without changing read status", () => {
    const mockMarkAsRead = vi.fn();
    const mockSetCategory = vi.fn();

    vi.mocked(useNotificationsModule.useNotifications).mockReturnValue({
      notifications: [
        { id: "1", event_type: "invoice.created", occurred_at: "2026-03-30T10:00:00Z", data: { invoice_id: "inv1" }, read: false },
      ],
      allNotifications: [
        { id: "1", event_type: "invoice.created", occurred_at: "2026-03-30T10:00:00Z", data: { invoice_id: "inv1" }, read: false },
        { id: "2", event_type: "pool.deposit", occurred_at: "2026-03-30T10:05:00Z", data: { amount: "100" }, read: true },
      ],
      isLoading: false,
      error: null,
      category: "all",
      setCategory: mockSetCategory,
      counts: { all: 2, unread: 1, invoice: 1, pool: 1, account: 0, filtered: 1 },
      markAsRead: mockMarkAsRead,
      markAllAsRead: vi.fn(),
      refetch: vi.fn(),
    });

    render(<NotificationBell />);

    // Open popup
    fireEvent.click(screen.getByRole("button", { name: /Open notifications/i }));
    expect(screen.getByText("invoice.created")).toBeInTheDocument();

    // Click filter category
    fireEvent.click(screen.getByText(/Invoices/i));
    expect(mockSetCategory).toHaveBeenCalledWith("invoice");
  });

  it("displays correct empty state when category has no notifications", () => {
    vi.mocked(useNotificationsModule.useNotifications).mockReturnValue({
      notifications: [],
      allNotifications: [],
      isLoading: false,
      error: null,
      category: "pool",
      setCategory: vi.fn(),
      counts: { all: 0, unread: 0, invoice: 0, pool: 0, account: 0, filtered: 0 },
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      refetch: vi.fn(),
    });

    render(<NotificationBell />);

    fireEvent.click(screen.getByRole("button", { name: /Open notifications/i }));
    expect(screen.getByText(/No pool notifications/i)).toBeInTheDocument();
  });
});
