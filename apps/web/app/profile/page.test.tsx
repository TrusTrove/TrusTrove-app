import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
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

describe("Profile registration dialog", () => {
  it("opens in an accessible fixed overlay", () => {
    render(<ProfilePage />);

    fireEvent.click(screen.getByRole("button", { name: "Register profile" }));

    const dialog = screen.getByRole("dialog", {
      name: "Register Business Metadata",
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
      name: "Register profile",
    });
    await user.click(openButton);

    const dialog = screen.getByRole("dialog", {
      name: "Register Business Metadata",
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
      name: "Register profile",
    });
    await user.click(openButton);

    // Escape should close the modal (useFocusTrap calls onEscape)
    await user.keyboard("{Escape}");

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

  it("restores focus to the trigger button when modal closes via close button", async () => {
    const user = userEvent.setup();
    render(<ProfilePage />);

    const openButton = screen.getByRole("button", {
      name: "Register profile",
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
