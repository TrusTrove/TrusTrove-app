import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useFocusTrap } from "./useFocusTrap";

type ProbeProps = {
  enabled: boolean;
  onEscape?: () => void;
  children?: React.ReactNode;
};

// Kept JSX-free so the file can carry the `.test.ts` extension required by
// #304 (React hooks in this repo are tested from `.test.ts` files).
function Probe({ enabled, onEscape, children }: ProbeProps) {
  const ref = useFocusTrap<HTMLDivElement>(enabled, onEscape);
  const content =
    children ??
    React.createElement(
      React.Fragment,
      null,
      React.createElement("button", { type: "button" }, "first"),
      React.createElement("button", { type: "button" }, "last"),
    );
  return React.createElement(
    "div",
    { ref, tabIndex: -1, "data-testid": "trap" },
    content,
  );
}

function renderProbe(props: ProbeProps) {
  return render(React.createElement(Probe, props));
}

function trap() {
  return screen.getByTestId("trap");
}

describe("useFocusTrap", () => {
  it("moves focus to the first focusable child when enabled", () => {
    renderProbe({ enabled: true });

    expect(screen.getByRole("button", { name: "first" })).toHaveFocus();
  });

  it("focuses the container itself when it has no focusable children", () => {
    renderProbe({
      enabled: true,
      children: React.createElement("span", null, "nothing focusable"),
    });

    expect(trap()).toHaveFocus();
  });

  it("cycles forward from the last element back to the first", () => {
    renderProbe({ enabled: true });
    screen.getByRole("button", { name: "last" }).focus();

    fireEvent.keyDown(trap(), { key: "Tab" });

    expect(screen.getByRole("button", { name: "first" })).toHaveFocus();
  });

  it("cycles backward from the first element to the last", () => {
    renderProbe({ enabled: true });
    screen.getByRole("button", { name: "first" }).focus();

    fireEvent.keyDown(trap(), { key: "Tab", shiftKey: true });

    expect(screen.getByRole("button", { name: "last" })).toHaveFocus();
  });

  it("leaves focus untouched for Tab presses inside the trap", () => {
    renderProbe({ enabled: true });
    const first = screen.getByRole("button", { name: "first" });
    first.focus();

    fireEvent.keyDown(trap(), { key: "Tab" });

    expect(first).toHaveFocus();
  });

  it("invokes onEscape when Escape is pressed while enabled", () => {
    const onEscape = vi.fn();
    renderProbe({ enabled: true, onEscape });

    fireEvent.keyDown(trap(), { key: "Escape" });

    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("stops Escape from propagating past the document", () => {
    const onEscape = vi.fn();
    const onWindow = vi.fn();
    window.addEventListener("keydown", onWindow, { once: true });
    renderProbe({ enabled: true, onEscape });

    fireEvent.keyDown(trap(), { key: "Escape" });

    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(onWindow).not.toHaveBeenCalled();
    window.removeEventListener("keydown", onWindow);
  });

  it("does not trap focus or handle keys while disabled", () => {
    const onEscape = vi.fn();
    renderProbe({ enabled: false, onEscape });
    const last = screen.getByRole("button", { name: "last" });

    last.focus();
    fireEvent.keyDown(trap(), { key: "Escape" });
    fireEvent.keyDown(trap(), { key: "Tab" });

    expect(onEscape).not.toHaveBeenCalled();
    expect(last).toHaveFocus();
  });

  it("restores focus to the previously focused element once disabled", async () => {
    const outside = document.createElement("button");
    outside.textContent = "outside";
    document.body.appendChild(outside);
    outside.focus();
    expect(outside).toHaveFocus();

    const { rerender } = renderProbe({ enabled: true });
    expect(screen.getByRole("button", { name: "first" })).toHaveFocus();

    rerender(React.createElement(Probe, { enabled: false }));

    await waitFor(() => expect(outside).toHaveFocus());
    outside.remove();
  });
});
