"use client";

import { useEffect, useRef } from "react";

/**
 * Custom hook that traps keyboard focus within a container element.
 *
 * When `enabled` is `true`, the hook:
 * 1. Saves the currently focused element and moves focus into the container
 *    (first focusable child, or the container itself if none exist).
 * 2. Intercepts Tab and Shift+Tab key presses so focus cycles within the
 *    container rather than escaping to elements outside it.
 * 3. Intercepts the Escape key, stops its propagation, and invokes the
 *    optional `onEscape` callback.
 * 4. On cleanup (or when `enabled` becomes `false`), restores focus to the
 *    element that was focused before the trap activated.
 *
 * Attach the returned ref to the container element whose focus should be
 * trapped (e.g. a modal dialog, dropdown, or popover).
 *
 * @param enabled - Whether the focus trap is active. Pass `false` to disable
 *   the trap without removing the ref from the DOM.
 * @param onEscape - Optional callback invoked when the Escape key is pressed
 *   while the trap is active. Useful for closing modals or dismissing menus.
 *
 * @returns A React ref object to attach to the focus-trap container element.
 *
 * @example
 * const modalRef = useFocusTrap(isOpen, () => setIsOpen(false));
 *
 * return (
 *   <dialog ref={modalRef} open={isOpen}>
 *     <button>First</button>
 *     <button>Last</button>
 *   </dialog>
 * );
 */
export function useFocusTrap<T extends HTMLElement>(
  enabled: boolean,
  onEscape?: () => void,
) {
  const ref = useRef<T>(null);
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    if (!enabled) return;

    const previousFocus = document.activeElement as HTMLElement | null;

    const container = ref.current;
    if (container) {
      const focusable = getFocusableElements(container);
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        container.focus();
      }
    }

    return () => {
      requestAnimationFrame(() => {
        previousFocus?.focus?.();
      });
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onEscapeRef.current?.();
        return;
      }

      if (e.key !== "Tab") return;

      const container = ref.current;
      if (!container) return;

      const focusable = getFocusableElements(container);
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);

  return ref;
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selectors = [
    "a[href]",
    "button:not([disabled])",
    "textarea:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
  ];

  return Array.from(
    container.querySelectorAll<HTMLElement>(selectors.join(",")),
  ).filter((el) => {
    const style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
  });
}
