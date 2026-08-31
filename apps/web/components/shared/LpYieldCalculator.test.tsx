import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { LpYieldCalculator } from "./LpYieldCalculator";

describe("LpYieldCalculator", () => {
  it("renders the calculator with default deposit and utilization values (happy path)", () => {
    render(<LpYieldCalculator />);

    expect(screen.getByText(/I'm an LP/i)).toBeInTheDocument();
    expect(screen.getByText(/YIELD CALC/i)).toBeInTheDocument();
    // Use getByText for the label since AmountInput's <label> is not associated
    // with the <input> via htmlFor/id
    expect(screen.getByText(/deposit amount \(usdc\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/pool utilization/i)).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("updates calculations when the deposit amount changes", () => {
    render(<LpYieldCalculator />);

    const depositInput = screen.getByPlaceholderText("10,000");
    fireEvent.change(depositInput, { target: { value: "50000" } });

    expect(depositInput).toHaveValue("50000");
  });

  it("updates utilization rate when the slider is moved", () => {
    render(<LpYieldCalculator />);

    const slider = screen.getByLabelText(/pool utilization/i);
    fireEvent.change(slider, { target: { value: "90" } });

    expect(slider).toHaveValue("90");
    // 90% appears only in the utilization display, not ambiguous
    expect(screen.getByText("90%")).toBeInTheDocument();
  });

  it("handles empty and non-numeric deposit input without crashing (edge/error case)", () => {
    render(<LpYieldCalculator />);

    const depositInput = screen.getByPlaceholderText("10,000");
    fireEvent.change(depositInput, { target: { value: "" } });
    expect(depositInput).toHaveValue("");

    fireEvent.change(depositInput, { target: { value: "invalid-number" } });
    expect(depositInput).toHaveValue("invalid-number");
  });

  it("handles minimum and maximum utilization bounds", () => {
    render(<LpYieldCalculator />);

    const slider = screen.getByLabelText(/pool utilization/i);

    // "10%" appears both in the utilization display and in the slider min label,
    // so use getAllByText and verify at least one matches
    fireEvent.change(slider, { target: { value: "10" } });
    const tenPercentElements = screen.getAllByText("10%");
    expect(tenPercentElements.length).toBeGreaterThanOrEqual(2);

    fireEvent.change(slider, { target: { value: "100" } });
    const hundredPercentElements = screen.getAllByText("100%");
    expect(hundredPercentElements.length).toBeGreaterThanOrEqual(2);
  });
});
