import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { SimulationPreview } from "@/components/shared/SimulationPreview";

describe("Regression: SimulationPreview fallback state (PR #176)", () => {
  it("shows simulation unavailable message when isFallback is true and details are null", () => {
    render(
      <SimulationPreview
        details={null}
        error={null}
        isLoading={false}
        isFallback={true}
      />,
    );

    expect(screen.getByText(/simulation unavailable/i)).toBeInTheDocument();
    expect(
      screen.getByText(/live simulation data is currently unavailable/i),
    ).toBeInTheDocument();
  });

  it("returns null when isFallback is false and details are null", () => {
    const { container } = render(
      <SimulationPreview
        details={null}
        error={null}
        isLoading={false}
        isFallback={false}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("shows loading state when isLoading is true", () => {
    render(
      <SimulationPreview
        details={null}
        error={null}
        isLoading={true}
        isFallback={false}
      />,
    );

    expect(screen.getByText(/simulating transaction/i)).toBeInTheDocument();
  });

  it("shows error state when error is provided", () => {
    render(
      <SimulationPreview
        details={null}
        error="Transaction simulation failed"
        isLoading={false}
        isFallback={false}
      />,
    );

    expect(
      screen.getAllByText(/simulation failed/i).length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText(/transaction simulation failed/i),
    ).toBeInTheDocument();
  });

  it("renders details when provided", () => {
    render(
      <SimulationPreview
        details={{
          estimatedFeeXlm: "0.001",
          functionName: "list_for_financing",
          expectedResult: null,
          footprintSize: 4,
        }}
        error={null}
        isLoading={false}
        isFallback={false}
      />,
    );

    expect(screen.getByText(/transaction preview/i)).toBeInTheDocument();
    expect(screen.getByText(/list_for_financing/i)).toBeInTheDocument();
    expect(screen.getByText(/0.001/i)).toBeInTheDocument();
  });
});
