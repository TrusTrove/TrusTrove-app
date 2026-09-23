import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useFocusTrap } from "./useFocusTrap";

function TestComponent({ enabled, onEscape }: { enabled: boolean; onEscape?: () => void }) {
  const ref = useFocusTrap<HTMLDivElement>(enabled, onEscape);
  return (
    <div>
      <button data-testid="outside">Outside Button</button>
      <div ref={ref} data-testid="container">
        <button data-testid="inside-1">Inside Button 1</button>
        <button data-testid="inside-2">Inside Button 2</button>
      </div>
    </div>
  );
}

describe("useFocusTrap", () => {
  it("traps focus when enabled", async () => {
    const user = userEvent.setup();
    render(<TestComponent enabled={true} />);

    // Wait for the effect to shift focus inside
    expect(screen.getByTestId("inside-1")).toHaveFocus();

    // Tab should move to the second button
    await user.tab();
    expect(screen.getByTestId("inside-2")).toHaveFocus();

    // Tab again should wrap back to the first button (trapped)
    await user.tab();
    expect(screen.getByTestId("inside-1")).toHaveFocus();

    // Shift+Tab should wrap to the last button
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(screen.getByTestId("inside-2")).toHaveFocus();
  });

  it("calls onEscape when Escape key is pressed", async () => {
    const user = userEvent.setup();
    const onEscape = vi.fn();
    render(<TestComponent enabled={true} onEscape={onEscape} />);

    // Wait for initial focus
    expect(screen.getByTestId("inside-1")).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("does not trap focus when disabled", async () => {
    const user = userEvent.setup();
    render(<TestComponent enabled={false} />);

    // Should not automatically focus anything inside container
    expect(screen.getByTestId("inside-1")).not.toHaveFocus();
  });
});
