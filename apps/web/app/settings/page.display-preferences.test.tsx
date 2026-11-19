import fs from "node:fs";
import path from "node:path";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "@/app/settings/page";

vi.mock("@/store/wallet", () => ({
  useWalletStore: (selector: any) => {
    // Disconnected: the notifications section is not rendered, so the only
    // checkboxes on the page are the two motion controls.
    const state = { connected: false, address: null };
    return selector ? selector(state) : state;
  },
}));

vi.mock("@/components/shared/PageLayout", () => ({
  PageLayout: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));

vi.mock("@/components/shared/ThemeToggle", () => ({
  ThemeToggle: () => null,
}));

const DISPLAY_STORAGE_KEY = "trusttrove:display";
const root = document.documentElement;

function resetDocumentPreferences() {
  delete root.dataset.density;
  delete root.dataset.animations;
  root.classList.remove("reduce-motion");
}

function readStoredDisplayPrefs() {
  return JSON.parse(
    localStorage.getItem(DISPLAY_STORAGE_KEY) ?? "{}",
  ) as Record<string, unknown>;
}

describe("Settings display preferences", () => {
  beforeEach(() => {
    localStorage.clear();
    resetDocumentPreferences();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    resetDocumentPreferences();
  });

  it("publishes the default preferences on <html> when the page mounts", () => {
    render(<SettingsPage />);

    expect(root).toHaveAttribute("data-density", "comfortable");
    expect(root).toHaveAttribute("data-animations", "on");
    expect(root).not.toHaveClass("reduce-motion");
  });

  it("renders a different density value when compact is selected", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.click(screen.getByRole("radio", { name: "compact" }));

    expect(root).toHaveAttribute("data-density", "compact");
    expect(readStoredDisplayPrefs()).toMatchObject({ density: "compact" });
  });

  it("stops animations through the document when both motion controls are off", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.click(screen.getByRole("checkbox", { name: /UI Animations/ }));
    await user.click(screen.getByRole("checkbox", { name: /Reduced Motion/ }));

    expect(root).toHaveAttribute("data-animations", "off");
    expect(root).toHaveClass("reduce-motion");
    expect(readStoredDisplayPrefs()).toMatchObject({
      animations: false,
      reducedMotion: true,
    });
  });

  it("re-applies every stored preference after a reload", async () => {
    const user = userEvent.setup();
    const first = render(<SettingsPage />);

    await user.click(screen.getByRole("radio", { name: "compact" }));
    await user.click(screen.getByRole("checkbox", { name: /UI Animations/ }));
    await user.click(screen.getByRole("checkbox", { name: /Reduced Motion/ }));

    // Simulate a reload: the document starts from scratch, only localStorage
    // survives, and the page mounts again.
    first.unmount();
    resetDocumentPreferences();
    render(<SettingsPage />);

    expect(root).toHaveAttribute("data-density", "compact");
    expect(root).toHaveAttribute("data-animations", "off");
    expect(root).toHaveClass("reduce-motion");

    // The controls themselves reflect the restored values, too.
    expect(screen.getByRole("radio", { name: "compact" })).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /UI Animations/ }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /Reduced Motion/ }),
    ).toBeChecked();
  });

  it("has a CSS rule for every attribute the page publishes", () => {
    // The bug in #1111 was a preference written to the document that nothing
    // consumed, so the pairing between page and stylesheet is what is under
    // test here, not the visual result.
    const css = fs.readFileSync(
      path.resolve(__dirname, "../globals.css"),
      "utf8",
    );

    expect(css).toContain('[data-density="compact"]');
    expect(css).toContain('[data-animations="off"]');
    expect(css).toContain(".reduce-motion");
  });
});
