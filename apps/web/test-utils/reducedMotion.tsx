import React from "react";
import { vi } from "vitest";

/**
 * Installs a `window.matchMedia` stub that reports `matches: true` for
 * reduced-motion queries when `reduce` is set. Returns a restore function.
 */
export function mockPrefersReducedMotion(reduce: boolean) {
  const original = window.matchMedia;

  const matchMedia = vi.fn((query: string) => {
    const matches = reduce && query.includes("prefers-reduced-motion");
    return {
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    } as unknown as MediaQueryList;
  });

  Object.defineProperty(window, "matchMedia", {
    value: matchMedia,
    writable: true,
    configurable: true,
  });

  return () => {
    Object.defineProperty(window, "matchMedia", {
      value: original,
      writable: true,
      configurable: true,
    });
  };
}

/**
 * Reads the reduced-motion preference through `window.matchMedia`, the same
 * signal framer-motion's `useReducedMotion()` reads.
 */
export function prefersReducedMotionFromMediaQuery(): boolean {
  return Boolean(
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );
}

/**
 * Serializes a motion prop so it can be asserted on from the DOM. `Infinity`
 * has no JSON representation, so it is encoded as the string "Infinity".
 */
export function serializeMotionProp(value: unknown): string {
  return JSON.stringify(value ?? null, (_key, v) =>
    v === Infinity ? "Infinity" : v,
  );
}

/**
 * Builds a stand-in for framer-motion's `motion.<tag>` components that renders
 * the plain element and exposes the `animate`/`transition` props it was given
 * as `data-animate` / `data-transition` attributes.
 */
// Props framer-motion consumes itself and that must never reach the DOM.
const MOTION_ONLY_PROPS = [
  "initial",
  "exit",
  "variants",
  "whileHover",
  "whileTap",
  "whileFocus",
  "whileDrag",
  "whileInView",
  "layout",
  "layoutId",
  "drag",
] as const;

/**
 * Builds a stand-in for framer-motion's `motion.<tag>` components that renders
 * the plain element and exposes the `animate`/`transition` props it was given
 * as `data-animate` / `data-transition` attributes.
 */
export function createMotionPropRecorder() {
  return new Proxy(
    {},
    {
      get(_target, tag: string) {
        const Recorder = (props: Record<string, unknown>) => {
          const { animate, transition, children, ...rest } = props;
          for (const key of MOTION_ONLY_PROPS) delete rest[key];

          return React.createElement(
            tag,
            {
              ...rest,
              "data-animate": serializeMotionProp(animate),
              "data-transition": serializeMotionProp(transition),
            },
            children as React.ReactNode,
          );
        };
        Recorder.displayName = `motion.${tag}`;
        return Recorder;
      },
    },
  );
}
