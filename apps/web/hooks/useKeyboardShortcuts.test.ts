import React from "react";
import { render, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";
import { useSettingsStore } from "@/store/settings";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => "/dashboard",
}));

function TestComponent() {
  useKeyboardShortcuts();
  return (
    <div>
      <input data-testid="test-input" />
      <textarea data-testid="test-textarea" />
      <div data-testid="normal-div">Normal content</div>
    </div>
  );
}

describe("useKeyboardShortcuts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({ keyboardShortcutsEnabled: true });
  });

  it("navigates to marketplace when 'm' is pressed outside inputs", () => {
    render(<TestComponent />);
    fireEvent.keyDown(window, { key: "m" });
    expect(mockPush).toHaveBeenCalledWith("/marketplace");
  });

  it("navigates to sme (invoices) when 'i' is pressed", () => {
    render(<TestComponent />);
    fireEvent.keyDown(window, { key: "i" });
    expect(mockPush).toHaveBeenCalledWith("/sme");
  });

  it("navigates to lp when 'l' is pressed", () => {
    render(<TestComponent />);
    fireEvent.keyDown(window, { key: "l" });
    expect(mockPush).toHaveBeenCalledWith("/lp");
  });

  it("navigates to settings when 's' is pressed", () => {
    render(<TestComponent />);
    fireEvent.keyDown(window, { key: "s" });
    expect(mockPush).toHaveBeenCalledWith("/settings");
  });

  it("navigates to help when 'h' is pressed", () => {
    render(<TestComponent />);
    fireEvent.keyDown(window, { key: "h" });
    expect(mockPush).toHaveBeenCalledWith("/help");
  });

  it("does not navigate when typing inside an input", () => {
    const { getByTestId } = render(<TestComponent />);
    const input = getByTestId("test-input");
    fireEvent.keyDown(input, { key: "m" });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("does not navigate when keyboard shortcuts are disabled in settings", () => {
    useSettingsStore.setState({ keyboardShortcutsEnabled: false });
    render(<TestComponent />);
    fireEvent.keyDown(window, { key: "m" });
    expect(mockPush).not.toHaveBeenCalled();
  });
});
