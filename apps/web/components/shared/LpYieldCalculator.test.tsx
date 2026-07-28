import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LpYieldCalculator } from "./LpYieldCalculator";

describe("LpYieldCalculator", () => {
  it("renders the default yield and earnings estimates", () => {
    render(<LpYieldCalculator />);

    expect(screen.getAllByText("9.13%")).toHaveLength(2);
    expect(screen.getByText("76.04 USDC")).toBeInTheDocument();
    expect(screen.getByText("TrusTrove LP")).toBeInTheDocument();
    expect(screen.getByText("Savings Account")).toBeInTheDocument();
    expect(screen.getByText("T-Bills")).toBeInTheDocument();
  });

  it("recalculates yield and monthly earnings when inputs change", () => {
    render(<LpYieldCalculator />);

    const depositInput = screen.getByPlaceholderText("10,000");
    const utilizationSlider = screen.getByRole("slider", {
      name: "Pool Utilization",
    });

    fireEvent.change(depositInput, { target: { value: "2500" } });
    fireEvent.change(utilizationSlider, { target: { value: "100" } });

    expect(screen.getAllByText("12.17%")).toHaveLength(2);
    expect(screen.getByText("25.35 USDC")).toBeInTheDocument();
    expect(utilizationSlider).toHaveAttribute("aria-valuenow", "100");
  });

  it("handles an invalid deposit value without producing invalid output", () => {
    render(<LpYieldCalculator />);

    const depositInput = screen.getByPlaceholderText("10,000");
    fireEvent.change(depositInput, { target: { value: "not-a-number" } });

    expect(screen.getAllByText("9.13%")).toHaveLength(2);
    expect(screen.getByText("0.00 USDC")).toBeInTheDocument();
  });
});
