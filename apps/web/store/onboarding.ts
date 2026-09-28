import { create } from "zustand";

/**
 * `localStorage` key recording that this browser has already been shown the
 * first-connect onboarding tour. Once set, the tour only opens on request.
 */
export const ONBOARDING_SEEN_KEY = "trusttrove:onboarding-tour-seen";

/** Whether this browser has already been shown the tour automatically. */
export function hasSeenOnboarding(): boolean {
  try {
    return window.localStorage.getItem(ONBOARDING_SEEN_KEY) === "true";
  } catch {
    // Storage disabled (e.g. Safari private mode): treat as seen so the tour
    // cannot reopen on every connect when the flag can never be persisted.
    return true;
  }
}

/** Records that the tour has been shown, ignoring storage failures. */
export function markOnboardingSeen(): void {
  try {
    window.localStorage.setItem(ONBOARDING_SEEN_KEY, "true");
  } catch {
    // Nothing to do — see hasSeenOnboarding().
  }
}

interface OnboardingState {
  open: boolean;
  /** Opens the tour from its first step. */
  start: () => void;
  close: () => void;
}

export const useOnboardingStore = create<OnboardingState>()((set) => ({
  open: false,
  start: () => set({ open: true }),
  close: () => set({ open: false }),
}));
