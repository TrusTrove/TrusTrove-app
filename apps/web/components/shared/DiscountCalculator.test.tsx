import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DiscountCalculator } from "./DiscountCalculator";

describe("DiscountCalculator", () => {
  it("renders successfully and calculates discount for happy path", () => {
    render(<DiscountCalculator />);
    const faceValueInput = screen.getByLabelText(/face value/i);
    expect(faceValueInput).toBeInTheDocument();

    fireEvent.change(faceValueInput, { target: { value: "1000" } });
    expect(screen.getByText(/discounted/i)).toBeInTheDocument();
  });

  it("handles edge case with zero or negative values gracefully", () => {
    render(<DiscountCalculator />);
    const faceValueInput = screen.getByLabelText(/face value/i);
    fireEvent.change(faceValueInput, { target: { value: "0" } });
    expect(screen.getByText(/0/)).toBeInTheDocument();
  });

  it("handles error path or invalid input", () => {
    render(<DiscountCalculator />);
    const faceValueInput = screen.getByLabelText(/face value/i);
    fireEvent.change(faceValueInput, { target: { value: "abc" } });
    expect(screen.getByText(/invalid/i)).toBeInTheDocument();
  });
});
