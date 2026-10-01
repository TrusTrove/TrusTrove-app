"use client";

import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  /** Extra classes merged onto the button. */
  className?: string;
}

/**
 * Sun/moon button that switches the app between the light and dark palettes.
 *
 * The active theme is owned by {@link useTheme}; this component only renders
 * the control. Until the hook has adopted the pre-paint theme the icon is
 * rendered in its server state (moon, i.e. "switch to light") so the markup
 * hydrates cleanly.
 *
 * @param props - See {@link ThemeToggleProps}.
 * @returns A button that toggles the colour theme.
 *
 * @example
 * ```tsx
 * <ThemeToggle className="ml-2" />
 * ```
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, mounted, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const label = isDark ? "Switch to light theme" : "Switch to dark theme";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      aria-pressed={mounted ? !isDark : undefined}
      className={cn(
        "inline-flex items-center justify-center rounded-lg border border-border bg-background-secondary p-2",
        "text-muted-foreground transition hover:border-primary/40 hover:text-primary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      {isDark ? (
        <Moon className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Sun className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
}
