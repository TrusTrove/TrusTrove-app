import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TransactionPending } from "./TransactionPending";
import { mockPrefersReducedMotion } from "@/test-utils/reducedMotion";

// framer-motion's useReducedMotion() reads the OS preference through
// window.matchMedia. The stub keeps that contract while replacing the motion
// primitives with recorders so the animate/transition props the component
// passes are observable from the DOM (Issue #667).
vi.mock("framer-motion", async () => {
  const { createMotionPropRecorder, prefersReducedMotionFromMediaQuery } =
    await import("@/test-utils/reducedMotion");
  return {
    useReducedMotion: () => prefersReducedMotionFromMediaQuery(),
    motion: createMotionPropRecorder(),
  };
});

let restoreMatchMedia: (() => void) | undefined;

afterEach(() => {
  restoreMatchMedia?.();
  restoreMatchMedia = undefined;
});

describe("TransactionPending reduced motion", () => {
  it("orbits indefinitely when motion is not reduced", () => {
    restoreMatchMedia = mockPrefersReducedMotion(false);

    render(<TransactionPending isOpen txHash="0x123" />);

    const orbit = screen.getByTestId("transaction-pending-orbit");
    expect(JSON.parse(orbit.getAttribute("data-animate")!)).toMatchObject({
      rotate: 360,
    });
    expect(JSON.parse(orbit.getAttribute("data-transition")!)).toMatchObject({
      repeat: "Infinity",
    });
  });

  it("renders the orbit statically when prefers-reduced-motion is set", () => {
    restoreMatchMedia = mockPrefersReducedMotion(true);

    render(<TransactionPending isOpen txHash="0x123" />);

    const orbit = screen.getByTestId("transaction-pending-orbit");
    expect(orbit.getAttribute("data-animate")).toBe("null");
    expect(JSON.parse(orbit.getAttribute("data-transition")!)).toMatchObject({
      repeat: 0,
    });
  });

  it("disables the inline status spinner under reduced motion via Tailwind", () => {
    restoreMatchMedia = mockPrefersReducedMotion(true);

    const { container } = render(<TransactionPending isOpen txHash="0x123" />);

    const spinner = container.querySelector(".animate-spin");
    expect(spinner).not.toBeNull();
    expect(spinner!.getAttribute("class")).toContain(
      "motion-reduce:animate-none",
    );
  });
});
