import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import { OnboardingTour, TOUR_STEPS } from "./OnboardingTour";
import messages from "@/messages/en.json";
import { useWalletStore } from "@/store/wallet";
import {
  ONBOARDING_SEEN_KEY,
  hasSeenOnboarding,
  useOnboardingStore,
} from "@/store/onboarding";

function renderTour(extra?: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {extra}
      <OnboardingTour />
    </NextIntlClientProvider>,
  );
}

function connectWallet() {
  act(() => useWalletStore.getState().connect("GABC", "TESTNET"));
}

const dialog = () => screen.getByRole("dialog");
const TOTAL = TOUR_STEPS.length;

describe("OnboardingTour", () => {
  beforeEach(() => {
    localStorage.clear();
    useOnboardingStore.setState({ open: false });
    useWalletStore.getState().disconnect();
  });

  afterEach(() => {
    useOnboardingStore.setState({ open: false });
  });

  it("stays closed while no wallet is connected", () => {
    renderTour();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens automatically on the first connect and records the flag", () => {
    renderTour();
    connectWallet();

    expect(dialog()).toHaveAccessibleName("Welcome to TrusTrove");
    expect(dialog()).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText(`Step 1 of ${TOTAL}`)).toBeInTheDocument();
    expect(localStorage.getItem(ONBOARDING_SEEN_KEY)).toBe("true");
  });

  it("never opens automatically once it has been seen", () => {
    localStorage.setItem(ONBOARDING_SEEN_KEY, "true");
    renderTour();
    connectWallet();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not reopen on a later reconnect after being dismissed", () => {
    renderTour();
    connectWallet();
    fireEvent.click(screen.getByRole("button", { name: "Skip tour" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    act(() => useWalletStore.getState().disconnect());
    connectWallet();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("walks forward and back through every step, then finishes", () => {
    renderTour();
    connectWallet();

    expect(
      screen.queryByRole("button", { name: "Back" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(dialog()).toHaveAccessibleName("Pick your role");

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(dialog()).toHaveAccessibleName("Welcome to TrusTrove");

    for (let i = 1; i < TOTAL; i++) {
      fireEvent.click(screen.getByRole("button", { name: "Next" }));
    }
    expect(dialog()).toHaveAccessibleName("You're all set");
    expect(screen.getByText(`Step ${TOTAL} of ${TOTAL}`)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Skip tour" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("dismisses on Escape", () => {
    renderTour();
    connectWallet();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("supports arrow-key navigation", () => {
    renderTour();
    connectWallet();
    fireEvent.keyDown(dialog(), { key: "ArrowRight" });
    expect(dialog()).toHaveAccessibleName("Pick your role");
    fireEvent.keyDown(dialog(), { key: "ArrowLeft" });
    expect(dialog()).toHaveAccessibleName("Welcome to TrusTrove");
  });

  it("moves focus to each step's title", () => {
    renderTour();
    connectWallet();
    expect(
      screen.getByRole("heading", { name: "Welcome to TrusTrove" }),
    ).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(
      screen.getByRole("heading", { name: "Pick your role" }),
    ).toHaveFocus();
  });

  it("traps Tab focus inside the dialog", () => {
    renderTour();
    connectWallet();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    const skip = screen.getByRole("button", { name: "Skip tour" });
    const next = screen.getByRole("button", { name: "Next" });

    next.focus();
    fireEvent.keyDown(next, { key: "Tab" });
    expect(skip).toHaveFocus();

    fireEvent.keyDown(skip, { key: "Tab", shiftKey: true });
    expect(next).toHaveFocus();
  });

  it("restores focus to the previously focused element on close", () => {
    renderTour(<button type="button">launcher</button>);
    const launcher = screen.getByRole("button", { name: "launcher" });
    launcher.focus();

    act(() => useOnboardingStore.getState().start());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(launcher).toHaveFocus();
  });

  it("can be relaunched manually while disconnected", () => {
    localStorage.setItem(ONBOARDING_SEEN_KEY, "true");
    renderTour();
    act(() => useOnboardingStore.getState().start());
    expect(dialog()).toHaveAccessibleName("Welcome to TrusTrove");
  });

  it("highlights a visible target and falls back to a centred card otherwise", () => {
    renderTour(
      <div data-tour="role-switcher" data-testid="role-target">
        role
      </div>,
    );
    const target = screen.getByTestId("role-target");
    target.getBoundingClientRect = () =>
      ({ top: 10, left: 20, width: 100, height: 30 }) as DOMRect;

    connectWallet();
    // Welcome step has no target.
    expect(
      screen.queryByTestId("onboarding-highlight"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    const highlight = screen.getByTestId("onboarding-highlight");
    expect(highlight.style.top).toBe("4px");
    expect(highlight.style.width).toBe("112px");

    // Balances target is absent (e.g. hidden on mobile) → centred card.
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(
      screen.queryByTestId("onboarding-highlight"),
    ).not.toBeInTheDocument();
  });
});

describe("onboarding storage helpers", () => {
  it("treats unavailable storage as already seen", () => {
    const original = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("denied");
      },
    });
    try {
      expect(hasSeenOnboarding()).toBe(true);
    } finally {
      Object.defineProperty(globalThis, "localStorage", {
        value: original,
        writable: true,
        configurable: true,
      });
    }
  });
});
