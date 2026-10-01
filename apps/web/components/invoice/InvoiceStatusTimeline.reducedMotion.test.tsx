import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InvoiceStatusTimeline } from "./InvoiceStatusTimeline";
import { mockPrefersReducedMotion } from "@/test-utils/reducedMotion";
import type { Invoice } from "@/types";

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

const issuer = "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB";
const buyer = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

const makeInvoice = (overrides: Partial<Invoice> = {}): Invoice => ({
  id: "invoice-1",
  status: "Created",
  issuer,
  buyer,
  faceValue: 1_000_000_000n,
  asset: "USDC",
  discountBps: 500,
  fundedAmount: 0n,
  dueDate: 1_735_689_600,
  createdAt: 1_735_430_400,
  fundedAt: null,
  shippedAt: null,
  issuerConfirmed: false,
  buyerConfirmed: false,
  repaidAt: null,
  ...overrides,
});

let restoreMatchMedia: (() => void) | undefined;

afterEach(() => {
  restoreMatchMedia?.();
  restoreMatchMedia = undefined;
});

describe("InvoiceStatusTimeline reduced motion", () => {
  it("pulses the current step indefinitely when motion is not reduced", () => {
    restoreMatchMedia = mockPrefersReducedMotion(false);

    render(<InvoiceStatusTimeline invoice={makeInvoice()} />);

    const pulse = screen.getByTestId("timeline-current-pulse");
    expect(pulse.getAttribute("data-animate")).toContain("opacity");
    expect(pulse.getAttribute("data-animate")).toContain("scale");
    expect(JSON.parse(pulse.getAttribute("data-transition")!)).toMatchObject({
      repeat: "Infinity",
    });
  });

  it("renders the current step statically when prefers-reduced-motion is set", () => {
    restoreMatchMedia = mockPrefersReducedMotion(true);

    render(<InvoiceStatusTimeline invoice={makeInvoice()} />);

    const pulse = screen.getByTestId("timeline-current-pulse");
    expect(pulse.getAttribute("data-animate")).toBe("null");
    expect(JSON.parse(pulse.getAttribute("data-transition")!)).toMatchObject({
      repeat: 0,
    });
  });
});
