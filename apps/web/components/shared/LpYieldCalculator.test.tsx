import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { LpYieldCalculator } from "./LpYieldCalculator";

describe("LpYieldCalculator", () => {
  it("renders default initial state with happy path calculations", () => {
    render(<LpYieldCalculator />);

    // Verify titles and headings
    expect(screen.getByText(/I'm an LP/i)).toBeInTheDocument();
    expect(screen.getByText(/YIELD CALC/i)).toBeInTheDocument();

    // Initial pool utilization is 75%
    expect(screen.getByText("75%")).toBeInTheDocument();

    // Initial Estimated Annual Yield (75% * 2.0% * (365/60) = 9.125% -> 9.13%)
    const yields = screen.getAllByText("9.13%");
    expect(yields.length).toBeGreaterThanOrEqual(1);

    // Initial Monthly Earnings for 10,000 USDC deposit -> 76.04 USDC
    expect(screen.getByText(/76\.04 USDC/i)).toBeInTheDocument();

    // Comparison values
    expect(screen.getByText(/TrusTrove LP/i)).toBeInTheDocument();
    expect(screen.getByText(/Savings Account/i)).toBeInTheDocument();
    expect(screen.getByText("5.00%")).toBeInTheDocument();
    expect(screen.getByText(/4\.50%/i)).toBeInTheDocument();
  });

  it("recalculates earnings when deposit input changes", () => {
    render(<LpYieldCalculator />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "50000" } });

    // Monthly earnings for 50,000 deposit at 9.125% yield: (50000 * 0.09125) / 12 = 380.21 USDC
    expect(screen.getByText(/380\.21 USDC/i)).toBeInTheDocument();
  });

  it("recalculates annual yield and monthly earnings when utilization slider changes", () => {
    render(<LpYieldCalculator />);

    const slider = screen.getByRole("slider", { name: /pool utilization/i });

    // Change utilization to 100%
    fireEvent.change(slider, { target: { value: "100" } });

    expect(screen.getByText("100%")).toBeInTheDocument();
    // 100% * 2.0% * (365 / 60) = 12.1666...% -> 12.17%
    const yields = screen.getAllByText("12.17%");
    expect(yields.length).toBeGreaterThanOrEqual(1);
    // Monthly earnings for 10,000 at 12.1666% = 101.39 USDC
    expect(screen.getByText(/101\.39 USDC/i)).toBeInTheDocument();
  });

  it("handles zero, empty, or non-numeric deposit edge cases gracefully without crashing", () => {
    render(<LpYieldCalculator />);

    const input = screen.getByRole("textbox");

    // Test empty input
    fireEvent.change(input, { target: { value: "" } });
    expect(screen.getByText(/0\.00 USDC/i)).toBeInTheDocument();

    // Test non-numeric input
    fireEvent.change(input, { target: { value: "abc" } });
    expect(screen.getByText(/0\.00 USDC/i)).toBeInTheDocument();

    // Test zero value
    fireEvent.change(input, { target: { value: "0" } });
    expect(screen.getByText(/0\.00 USDC/i)).toBeInTheDocument();
  });

  it("handles minimum utilization boundary value (10%)", () => {
    render(<LpYieldCalculator />);

    const slider = screen.getByRole("slider", { name: /pool utilization/i });
    fireEvent.change(slider, { target: { value: "10" } });

    // 10% * 2.0% * (365 / 60) = 1.2166...% -> 1.22%
    const yields = screen.getAllByText("1.22%");
    expect(yields.length).toBeGreaterThanOrEqual(1);
    // Monthly earnings for 10,000 at 1.2166...% = 10.14 USDC
    expect(screen.getByText(/10\.14 USDC/i)).toBeInTheDocument();
  });
});
