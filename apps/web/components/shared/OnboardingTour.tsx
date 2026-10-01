"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { useWalletStore } from "@/store/wallet";
import {
  hasSeenOnboarding,
  markOnboardingSeen,
  useOnboardingStore,
} from "@/store/onboarding";
import { cn } from "@/lib/utils";

/**
 * Tour steps, in order. `target` names the `data-tour` attribute of the
 * element a step highlights (see Navbar.tsx). Steps without a target, or whose
 * target is not currently visible (e.g. desktop nav links on a phone, or the
 * balances while disconnected), render as a centred dialog instead.
 */
export const TOUR_STEPS = [
  { id: "welcome" },
  { id: "role", target: "role-switcher" },
  { id: "balances", target: "balances" },
  { id: "dashboard", target: "nav-dashboard" },
  { id: "lp", target: "nav-lp" },
  { id: "marketplace", target: "nav-marketplace" },
  { id: "profile", target: "nav-profile" },
  { id: "done", target: "tour-launcher" },
] as const satisfies ReadonlyArray<{ id: string; target?: string }>;

const CARD_WIDTH = 360;
const GAP = 12;
const EDGE = 16;
const HIGHLIGHT_PADDING = 6;

type Rect = Pick<DOMRect, "top" | "left" | "width" | "height">;

function findVisibleTarget(target: string | undefined): Rect | null {
  if (!target) return null;
  const nodes = document.querySelectorAll<HTMLElement>(
    `[data-tour="${target}"]`,
  );
  for (const node of Array.from(nodes)) {
    const { top, left, width, height } = node.getBoundingClientRect();
    if (width > 0 && height > 0) return { top, left, width, height };
  }
  return null;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * First-connect onboarding walkthrough.
 *
 * Opens automatically the first time a wallet connects in this browser
 * (tracked with a `localStorage` flag, see store/onboarding.ts) and never
 * again on its own afterwards. It can be relaunched at any time through
 * `useOnboardingStore().start()` — the Navbar's "Take the tour" button.
 *
 * Mounted once by the Navbar, whose elements it highlights.
 */
export function OnboardingTour() {
  const connected = useWalletStore((s) => s.connected);
  const open = useOnboardingStore((s) => s.open);
  const start = useOnboardingStore((s) => s.start);

  useEffect(() => {
    if (connected && !hasSeenOnboarding()) {
      // Mark as seen as soon as it is shown, so closing the tab mid-tour does
      // not bring it back on the next connect.
      markOnboardingSeen();
      start();
    }
  }, [connected, start]);

  if (!open || typeof document === "undefined") return null;
  // Portalled to <body>: the Navbar's backdrop-blur creates a containing block
  // that would otherwise trap this `position: fixed` overlay inside the bar.
  return createPortal(<TourDialog />, document.body);
}

function TourDialog() {
  const t = useTranslations("OnboardingTour");
  const close = useOnboardingStore((s) => s.close);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  const step = TOUR_STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === TOUR_STEPS.length - 1;
  const target = "target" in step ? step.target : undefined;

  const next = useCallback(() => {
    if (isLast) close();
    else setStepIndex((i) => i + 1);
  }, [isLast, close]);
  const back = useCallback(() => setStepIndex((i) => Math.max(0, i - 1)), []);

  // Return focus to whatever was focused before the tour opened.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    return () => previouslyFocused?.focus?.();
  }, []);

  // Move focus to the step title so screen readers announce each new step.
  useEffect(() => {
    titleRef.current?.focus();
  }, [stepIndex]);

  // Track the highlighted element's position.
  useEffect(() => {
    const measure = () => {
      setRect(findVisibleTarget(target));
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [target]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close]);

  // Keep Tab / Shift+Tab inside the dialog; arrow keys step through the tour.
  const onDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      next();
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      back();
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === titleRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  let cardStyle: React.CSSProperties | undefined;
  if (rect) {
    const width = Math.min(CARD_WIDTH, viewport.width - EDGE * 2);
    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - width / 2, EDGE),
      viewport.width - width - EDGE,
    );
    const below = rect.top + rect.height + GAP;
    // Flip above the target when there is not enough room underneath.
    cardStyle =
      below + 220 > viewport.height
        ? { width, left, bottom: viewport.height - rect.top + GAP }
        : { width, left, top: below };
  }

  const titleId = `onboarding-step-${step.id}-title`;
  const bodyId = `onboarding-step-${step.id}-body`;

  return (
    <div className="fixed inset-0 z-[90]" data-testid="onboarding-tour">
      {/* Backdrop — a cut-out around the target when there is one. */}
      {rect ? (
        <div
          aria-hidden="true"
          data-testid="onboarding-highlight"
          className="fixed rounded-lg ring-2 ring-primary transition-all duration-200 motion-reduce:transition-none"
          style={{
            top: rect.top - HIGHLIGHT_PADDING,
            left: rect.left - HIGHLIGHT_PADDING,
            width: rect.width + HIGHLIGHT_PADDING * 2,
            height: rect.height + HIGHLIGHT_PADDING * 2,
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.6)",
          }}
        />
      ) : (
        <div aria-hidden="true" className="fixed inset-0 bg-black/60" />
      )}

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        onKeyDown={onDialogKeyDown}
        style={cardStyle}
        className={cn(
          "fixed rounded-xl border border-primary/30 bg-card p-5 text-card-foreground shadow-2xl",
          !rect &&
            "left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-[360px] -translate-x-1/2 -translate-y-1/2",
        )}
      >
        <p className="text-[10px] font-bold font-mono uppercase tracking-widest text-primary">
          {t("progress", {
            current: stepIndex + 1,
            total: TOUR_STEPS.length,
          })}
        </p>
        <h2
          id={titleId}
          ref={titleRef}
          tabIndex={-1}
          className="mt-2 text-base font-bold font-mono text-foreground focus:outline-none"
        >
          {t(`steps.${step.id}.title`)}
        </h2>
        <p
          id={bodyId}
          className="mt-2 text-sm leading-relaxed text-muted-foreground"
        >
          {t(`steps.${step.id}.body`)}
        </p>

        <div className="mt-5 flex items-center justify-between gap-2">
          {isLast ? (
            <span />
          ) : (
            <button
              type="button"
              onClick={close}
              className="rounded-md px-2 py-1.5 text-xs font-mono text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {t("skip")}
            </button>
          )}
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                type="button"
                onClick={back}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-bold font-mono text-foreground hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {t("back")}
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-bold font-mono text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            >
              {isLast ? t("finish") : t("next")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
