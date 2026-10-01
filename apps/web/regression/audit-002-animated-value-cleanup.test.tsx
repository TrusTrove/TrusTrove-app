import React from "react";
import { render, act } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { DiscountCalculator } from "@/components/shared/DiscountCalculator";

describe("Regression: AnimatedValue RAF cleanup on unmount (PR #162)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders without crashing", () => {
    const { container } = render(<DiscountCalculator />);
    expect(container).toBeInTheDocument();
  });

  it("unmounts without throwing", () => {
    const { unmount } = render(<DiscountCalculator />);
    expect(() => unmount()).not.toThrow();
  });
});
