import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "@/app/profile/page";

vi.mock("@/store/wallet", () => ({
  useWalletStore: (selector: any) => {
    const state = { connected: true, address: "GTESTADDRESS" };
    return selector ? selector(state) : state;
  },
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({
    profile: null,
    isProfileLoading: false,
    isVerified: false,
    isVerifiedLoading: false,
    register: vi.fn(),
    isRegistering: false,
    registerError: null,
  }),
}));

vi.mock("@/components/shared/PageLayout", () => ({
  PageLayout: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));

vi.mock("@/components/shared/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("@/components/shared/WalletConnect", () => ({
  WalletConnect: () => null,
}));

vi.mock("@/components/shared/TransactionPending", () => ({
  TransactionPending: () => null,
}));

describe("Notification preference toggles", () => {
  // Must mirror the category list rendered by NotificationPreferences.
  const categories = [
    "Invoice Created",
    "Invoice Listed",
    "Invoice Funded",
    "Invoice Shipped",
    "Delivery Confirmed",
    "Invoice Repaid",
    "Invoice Defaulted",
  ];

  beforeEach(() => {
    // Prefs persist in localStorage, so reset between tests to keep each
    // mount on the documented default (every category on).
    localStorage.clear();
  });

  it("gives every toggle an accessible name tied to its category", () => {
    render(<ProfilePage />);

    const toggles = screen.getAllByRole("checkbox");
    expect(toggles).toHaveLength(categories.length);

    for (const category of categories) {
      // The category text sits outside the <label>, so the accessible name
      // must come from aria-label (issue #875).
      expect(
        screen.getByRole("checkbox", { name: `${category} notifications` }),
      ).toBeInTheDocument();
    }
  });

  it("exposes checked state and flips it on click", async () => {
    const user = userEvent.setup();
    render(<ProfilePage />);

    const toggle = screen.getByRole("checkbox", {
      name: "Invoice Created notifications",
    });
    // Defaults are "on" until the user opts out.
    expect(toggle).toBeChecked();

    await user.click(toggle);
    expect(toggle).not.toBeChecked();

    await user.click(toggle);
    expect(toggle).toBeChecked();
  });
});

describe("Profile registration dialog", () => {
  it("opens in an accessible fixed overlay", () => {
    render(<ProfilePage />);

    fireEvent.click(
      screen.getByRole("button", { name: "Register Business Profile" }),
    );

    const dialog = screen.getByRole("dialog", {
      name: "Register Corporate Profile",
    });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("tabindex", "-1");
    expect(dialog).toHaveClass("fixed", "inset-0", "z-50");
    expect(
      screen.getByRole("button", { name: "Close registration dialog" }),
    ).toBeInTheDocument();
  });

  it("traps Tab and Shift+Tab focus within the modal", async () => {
    const user = userEvent.setup();
    render(<ProfilePage />);

    const openButton = screen.getByRole("button", {
      name: "Register Business Profile",
    });
    await user.click(openButton);

    const dialog = screen.getByRole("dialog", {
      name: "Register Corporate Profile",
    });

    // Collect all focusable elements inside the modal
    const focusableSelector = [
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      '[tabindex]:not([tabindex="-1"])',
    ].join(",");
    const focusableElements = Array.from(
      dialog.querySelectorAll<HTMLElement>(focusableSelector),
    ).filter((el) => {
      const style = window.getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden";
    });

    expect(focusableElements.length).toBeGreaterThanOrEqual(2);

    // Focus should start inside the modal (useFocusTrap moves focus to first element)
    expect(dialog).toContainElement(document.activeElement as HTMLElement);

    // Tab forward through all focusable elements and beyond — should cycle back
    for (let i = 0; i < focusableElements.length + 2; i++) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }

    // Tab backward through all focusable elements and beyond — should cycle back
    for (let i = 0; i < focusableElements.length + 2; i++) {
      await user.tab({ shift: true });
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
  });

  it("restores focus to the trigger button when modal closes via Escape", async () => {
    const user = userEvent.setup();
    render(<ProfilePage />);

    const openButton = screen.getByRole("button", {
      name: "Register Business Profile",
    });
    await user.click(openButton);

    // Escape should close the modal (useFocusTrap calls onEscape)
    await user.keyboard("{Escape}");

    // The dialog should no longer be in the document
    expect(
      screen.queryByRole("dialog", {
        name: "Register Corporate Profile",
      }),
    ).not.toBeInTheDocument();

    // useFocusTrap restores focus via requestAnimationFrame, so flush it
    await new Promise((r) => requestAnimationFrame(r));

    // Focus should return to the element that opened the modal
    expect(openButton).toHaveFocus();
  });

  it("restores focus to the trigger button when modal closes via close button", async () => {
    const user = userEvent.setup();
    render(<ProfilePage />);

    const openButton = screen.getByRole("button", {
      name: "Register Business Profile",
    });
    await user.click(openButton);

    // Click the close button
    const closeButton = screen.getByRole("button", {
      name: "Close registration dialog",
    });
    await user.click(closeButton);

    // The dialog should no longer be in the document
    expect(
      screen.queryByRole("dialog", {
        name: "Register Business Metadata",
      }),
    ).not.toBeInTheDocument();

    // useFocusTrap restores focus via requestAnimationFrame, so flush it
    await new Promise((r) => requestAnimationFrame(r));

    // Focus should return to the element that opened the modal
    expect(openButton).toHaveFocus();
  });
});
