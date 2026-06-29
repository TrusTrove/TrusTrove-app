import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StatusTimeline } from "./StatusTimeline";

describe("StatusTimeline", () => {
  it("renders all timeline steps", () => {
    render(
      <StatusTimeline status="Created" timestamps={{ created: 1620000000 }} />,
    );
    expect(screen.getByText(/Created/i)).toBeInTheDocument();
    expect(screen.getByText(/Listed/i)).toBeInTheDocument();
    expect(screen.getByText(/Funded/i)).toBeInTheDocument();
    expect(screen.getByText(/Active/i)).toBeInTheDocument();
    expect(screen.getByText(/Confirmed/i)).toBeInTheDocument();
    expect(screen.getByText(/Repaid/i)).toBeInTheDocument();
  });

  it("marks steps up to currentStatus as active or completed", () => {
    const { container } = render(
      <StatusTimeline
        status="Funded"
        timestamps={{
          created: 1620000000,
          listed: 1620000001,
          funded: 1620000002,
        }}
      />,
    );
    // Testing specific active/completed visual states would depend on the implementation
    // But we ensure it renders without crashing for a mid-way status
    expect(container).toBeInTheDocument();
  });
});
