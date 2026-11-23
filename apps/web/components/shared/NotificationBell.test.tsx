import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { NotificationBell } from "./NotificationBell";
import messages from "@/messages/en.json";
import type { NotificationEvent } from "@/types/notifications";

function renderBell(
  notifications: NotificationEvent[] = [],
  onOpen?: () => void,
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <NotificationBell notifications={notifications} onOpen={onOpen} />
    </NextIntlClientProvider>,
  );
}

function makeNotif(
  id: string,
  read: boolean,
  overrides: Partial<NotificationEvent> = {},
): NotificationEvent {
  return {
    id,
    type: "Invoice Created",
    invoiceId: `inv-${id}`,
    message: `Message ${id}`,
    timestamp: Date.now() / 1000 - 120,
    read,
    ...overrides,
  };
}

describe("NotificationBell", () => {
  it("renders empty state", () => {
    renderBell([]);
    const button = screen.getByRole("button", { name: /^Notifications$/i });
    expect(button).toBeDefined();

    fireEvent.click(button);
    expect(screen.getByText("No notifications yet")).toBeDefined();
  });

  it("renders unread count and items", () => {
    const mockNotifs = [
      makeNotif("1", false, { message: "New invoice" }),
    ];

    renderBell(mockNotifs);

    const button = screen.getByRole("button", {
      name: "Notifications, 1 unread",
    });
    fireEvent.click(button);

    expect(screen.getByText("1 new")).toBeDefined();
    expect(screen.getByText("Invoice Created")).toBeDefined();
    expect(screen.getByText("New invoice")).toBeDefined();
    expect(screen.getByText(/m ago/)).toBeDefined();
  });

  it("calls onOpen when opened", () => {
    const onOpen = vi.fn();
    renderBell([], onOpen);

    const button = screen.getByRole("button", { name: "Notifications" });
    fireEvent.click(button);

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("exposes unread count in the button aria-label for 0, 1, and multiple unread items", () => {
    const { rerender } = renderBell([makeNotif("1", true)]);
    expect(
      screen.getByRole("button", { name: "Notifications" }),
    ).toBeDefined();

    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <NotificationBell notifications={[makeNotif("1", false)]} />
      </NextIntlClientProvider>,
    );
    expect(
      screen.getByRole("button", { name: "Notifications, 1 unread" }),
    ).toBeDefined();

    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <NotificationBell
          notifications={[
            makeNotif("1", false),
            makeNotif("2", false),
            makeNotif("3", false),
            makeNotif("4", true),
          ]}
        />
      </NextIntlClientProvider>,
    );
    expect(
      screen.getByRole("button", { name: "Notifications, 3 unread" }),
    ).toBeDefined();
  });

  it("marks the unread indicator dot as aria-hidden", () => {
    renderBell([makeNotif("1", false)]);
    const button = screen.getByRole("button", {
      name: "Notifications, 1 unread",
    });
    const dot = button.querySelector("span[aria-hidden='true']");
    expect(dot).not.toBeNull();
  });

  it("sets aria-haspopup, aria-expanded, and aria-controls on the trigger and dialog semantics on the panel", () => {
    renderBell([makeNotif("1", false)]);
    const button = screen.getByRole("button", {
      name: "Notifications, 1 unread",
    });

    expect(button.getAttribute("aria-haspopup")).toBe("dialog");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("aria-controls")).toBeNull();

    fireEvent.click(button);

    const dialog = screen.getByRole("dialog", { name: "Notifications" });
    expect(dialog).toBeDefined();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.getAttribute("aria-controls")).toBe(dialog.getAttribute("id"));
  });

  it("renders notifications as a list with visually hidden Unread text only on unread items", () => {
    renderBell([
      makeNotif("1", false, { message: "First unread" }),
      makeNotif("2", true, { message: "Second read" }),
    ]);

    fireEvent.click(
      screen.getByRole("button", { name: "Notifications, 1 unread" }),
    );

    const list = screen.getByRole("list");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);

    expect(within(items[0]).getByText("Unread")).toBeDefined();
    expect(within(items[1]).queryByText("Unread")).toBeNull();
  });
});
