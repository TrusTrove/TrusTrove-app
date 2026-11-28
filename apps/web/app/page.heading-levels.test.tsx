import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HomePage from "@/app/page";

vi.mock("@/components/shared/TopStatusBar", () => ({
  TopStatusBar: () => null,
}));

vi.mock("@/components/shared/Navbar", () => ({
  Navbar: () => null,
}));

vi.mock("@/components/shared/InvoiceFeed", () => ({
  InvoiceFeed: () => null,
}));

vi.mock("@/components/shared/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("@/components/shared/HeroStats", () => ({
  HeroStats: () => null,
}));

vi.mock("@/components/shared/PillarStat", () => ({
  PillarStat: () => null,
}));

vi.mock("@/components/shared/HomePanels", () => ({
  HomeDiscountCalculator: () => null,
  HomeLpCalculator: () => null,
}));

describe("Landing page heading hierarchy (#992)", () => {
  it("does not skip heading levels on the landing page", () => {
    render(<HomePage />);

    // Get all headings with their levels
    const allHeadings = screen.getAllByRole("heading", { hidden: true });

    // Extract heading levels
    const levels = allHeadings.map((heading) => {
      const level = parseInt(heading.tagName.charAt(1), 10);
      return level;
    });

    // Check that no heading level is skipped
    // The hierarchy should be: h1 -> h2 -> h3 (no h4 directly after h2)
    for (let i = 1; i < levels.length; i++) {
      const currentLevel = levels[i];
      const previousLevel = levels[i - 1];

      // Headings should not skip more than one level
      // e.g., h2 should not be followed by h4
      const difference = currentLevel - previousLevel;
      expect(difference).toBeLessThanOrEqual(1);
    }

    // Verify the expected structure
    // - One h1 (main title)
    // - Multiple h2 (section titles)
    // - h3 for step cards and pillar cards (not h4)
    const h1Count = levels.filter((l) => l === 1).length;
    const h2Count = levels.filter((l) => l === 2).length;
    const h3Count = levels.filter((l) => l === 3).length;
    const h4Count = levels.filter((l) => l === 4).length;

    expect(h1Count).toBeGreaterThanOrEqual(1);
    expect(h2Count).toBeGreaterThanOrEqual(1);
    expect(h3Count).toBeGreaterThanOrEqual(1);
    // Should have no h4 after the fix
    expect(h4Count).toBe(0);
  });

  it("uses h3 for step cards in the workflow section", () => {
    render(<HomePage />);

    // The four step cards should use h3, not h4
    const stepHeadings = screen.getAllByRole("heading", {
      level: 3,
      hidden: true,
    });
    expect(stepHeadings.length).toBeGreaterThanOrEqual(4);
  });

  it("uses h3 for pillar cards in the architecture section", () => {
    render(<HomePage />);

    // The three pillar cards should use h3
    const pillarHeadings = screen.getAllByRole("heading", {
      level: 3,
      hidden: true,
    });
    expect(pillarHeadings.length).toBeGreaterThanOrEqual(3);
  });
});
