import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { SimulationPreview } from "@/components/shared/SimulationPreview";

const happyDetails = {
  estimatedFeeXlm: "0.0001",
  functionName: "create_invoice",
  expectedResult: { ok: true },
  footprintSize: 3,
};

describe("SimulationPreview", () => {
  it("renders the transaction preview with valid details", () => {
    render(
      <SimulationPreview
        details={happyDetails}
        error={null}
        isLoading={false}
        isFallback={false}
      />,
    );

    expect(screen.getByText("Transaction Preview")).toBeInTheDocument();
    expect(screen.getByText("create_invoice")).toBeInTheDocument();
    expect(screen.getByText("0.0001 XLM")).toBeInTheDocument();
    expect(screen.getByText("3 ledger entries")).toBeInTheDocument();
    expect(screen.getByText("Ready to Sign")).toBeInTheDocument();
  });

  it('uses singular "ledger entry" when footprintSize is 1', () => {
    render(
      <SimulationPreview
        details={{ ...happyDetails, footprintSize: 1 }}
        error={null}
        isLoading={false}
        isFallback={false}
      />,
    );

    expect(screen.getByText("1 ledger entry")).toBeInTheDocument();
    expect(screen.queryByText("1 ledger entries")).not.toBeInTheDocument();
  });

  it("renders nothing when details is null and not loading, erroring, or falling back", () => {
    const { container } = render(
      <SimulationPreview details={null} error={null} isLoading={false} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders the fallback warning when isFallback is true and details are null", () => {
    render(
      <SimulationPreview
        details={null}
        error={null}
        isLoading={false}
        isFallback={true}
      />,
    );

    expect(screen.getByText("Simulation Unavailable")).toBeInTheDocument();
    expect(
      screen.getByText(/live simulation data is currently unavailable/i),
    ).toBeInTheDocument();
  });

  it("renders the error message when error is provided", () => {
    const errorMessage = "Insufficient balance to cover the network fee.";

    render(
      <SimulationPreview
        details={null}
        error={errorMessage}
        isLoading={false}
      />,
    );

    expect(screen.getByText("Simulation Failed")).toBeInTheDocument();
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it("renders the loading skeleton while isLoading is true", () => {
    const { container } = render(
      <SimulationPreview details={null} error={null} isLoading={true} />,
    );

    expect(screen.getByText("Simulating Transaction...")).toBeInTheDocument();
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("shows the Estimate badge instead of Ready to Sign when isFallback is true", () => {
    render(
      <SimulationPreview
        details={happyDetails}
        error={null}
        isLoading={false}
        isFallback={true}
      />,
    );

    expect(screen.getByText("Estimate")).toBeInTheDocument();
    expect(screen.queryByText("Ready to Sign")).not.toBeInTheDocument();
  });
});
