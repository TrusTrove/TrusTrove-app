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

  it("anchors left and uses a viewport-capped width when align='left'", () => {
    const { container } = render(
      <NotificationBell notifications={[]} align="left" />,
    );

    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));

    const panel = container.querySelector("div.absolute");
    expect(panel).not.toBeNull();
    expect(panel?.className).toContain("left-0");
    expect(panel?.className).toContain("right-auto");
    expect(panel?.className).toContain("w-[min(20rem,calc(100vw-2rem))]");
    expect(panel?.className).not.toContain("md:right-auto");
    expect(panel?.className).not.toContain("md:left-auto");
  });
});
