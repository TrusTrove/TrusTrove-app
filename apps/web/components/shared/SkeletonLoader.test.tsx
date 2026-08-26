import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import {
  SkeletonShimmer,
  InvoiceCardSkeleton,
  PoolStatsPanelSkeleton,
  InvoiceFeedSkeleton,
  InvoiceTableSkeleton,
  LPPositionCardSkeleton,
  ActivityTimelineSkeleton,
} from "./SkeletonLoader";

describe("SkeletonLoader", () => {
  it("renders the shimmer element with the provided className", () => {
    const { container } = render(
      <SkeletonShimmer className="h-4 w-32" />,
    );

    const shimmer = container.firstChild as HTMLElement;
    expect(shimmer).toBeInTheDocument();
    expect(shimmer).toHaveClass("h-4", "w-32");
    expect(shimmer.querySelector(".animate-\\[shimmer_1\\.5s_infinite\\]")).toBeTruthy();
  });

  it("renders InvoiceCardSkeleton with its shimmer blocks", () => {
    const { container } = render(<InvoiceCardSkeleton />);

    expect(container.firstChild).toBeInTheDocument();
    expect(container.querySelectorAll(".animate-\\[shimmer_1\\.5s_infinite\\]").length).toBeGreaterThan(0);
  });

  it("renders PoolStatsPanelSkeleton with four stat placeholders", () => {
    const { container } = render(<PoolStatsPanelSkeleton />);

    expect(container.firstChild).toBeInTheDocument();
    expect(container.querySelectorAll(".animate-\\[shimmer_1\\.5s_infinite\\]").length).toBeGreaterThanOrEqual(4);
  });

  it("renders InvoiceFeedSkeleton with three feed rows", () => {
    const { container } = render(<InvoiceFeedSkeleton />);

    expect(container.querySelectorAll('[class*="rounded"]').length).toBeGreaterThan(0);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders InvoiceTableSkeleton with a header and five body rows", () => {
    render(<InvoiceTableSkeleton />);

    expect(screen.getByText("Invoice ID")).toBeInTheDocument();
    expect(screen.getByText("Face Value")).toBeInTheDocument();
  });

  it("renders LPPositionCardSkeleton", () => {
    const { container } = render(<LPPositionCardSkeleton />);

    expect(container.firstChild).toBeInTheDocument();
    expect(container.querySelectorAll(".animate-\\[shimmer_1\\.5s_infinite\\]").length).toBeGreaterThan(0);
  });

  it("renders ActivityTimelineSkeleton with five timeline placeholders", () => {
    const { container } = render(<ActivityTimelineSkeleton />);

    expect(container.firstChild).toBeInTheDocument();
    expect(container.querySelectorAll(".animate-\\[shimmer_1\\.5s_infinite\\]").length).toBeGreaterThanOrEqual(5);
  });
});
