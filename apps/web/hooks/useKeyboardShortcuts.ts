"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSettingsStore } from "@/store/settings";

/**
 * Custom hook that binds global navigation keyboard shortcuts:
 * - 'd' or 'D': Dashboard (/dashboard)
 * - 'i' or 'I': Invoices (/sme)
 * - 'm' or 'M': Marketplace (/marketplace)
 * - 'l' or 'L': LP (/lp)
 * - 's' or 'S': Settings (/settings)
 * - 'h' or 'H': Help (/help)
 *
 * Respects user settings (can be disabled via `keyboardShortcutsEnabled`), does not
 * trigger when focus is inside text inputs, textareas, contenteditable elements, or when modifier keys (Ctrl, Alt, Meta) are pressed.
 */
export function useKeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const { keyboardShortcutsEnabled } = useSettingsStore();

  useEffect(() => {
    if (!keyboardShortcutsEnabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Do not trigger if disabled in settings
      if (!useSettingsStore.getState().keyboardShortcutsEnabled) return;

      // Do not override standard browser or assistive tech modifier keys
      if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
        return;
      }

      // Do not trigger inside inputs, textareas, selects, or contenteditable elements
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable
        )
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      
      switch (key) {
        case "d":
          if (pathname !== "/dashboard") {
            router.push("/dashboard");
            event.preventDefault();
          }
          break;
        case "i":
          if (pathname !== "/sme") {
            router.push("/sme");
            event.preventDefault();
          }
          break;
        case "m":
          if (pathname !== "/marketplace") {
            router.push("/marketplace");
            event.preventDefault();
          }
          break;
        case "l":
          if (pathname !== "/lp") {
            router.push("/lp");
            event.preventDefault();
          }
          break;
        case "s":
          if (pathname !== "/settings") {
            router.push("/settings");
            event.preventDefault();
          }
          break;
        case "h":
          if (pathname !== "/help") {
            router.push("/help");
            event.preventDefault();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [router, pathname, keyboardShortcutsEnabled]);
}
