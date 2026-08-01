import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DiscountCalculator } from "./DiscountCalculator";

describe("DiscountCalculator", () => {
  it("renders the default SME financing calculation", () => {
    render(<DiscountCalculator />);

    expect(
      screen.getByText(/SME Financing Calculator/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Invoice Face Value")).toHaveValue(50000);
    expect(screen.getByLabelText("Financing Discount Rate")).toHaveValue(2);
    expect(screen.getByText(/60 Days/i)).toBeInTheDocument();
    expect(screen.getByText("49,000 USDC")).toBeInTheDocument();
    expect(screen.getAllByText("1,000 USDC")).toHaveLength(3);
  });

  it("calculates correctly at the minimum supported SME values", async () => {
    render(<DiscountCalculator />);

    fireEvent.change(screen.getByLabelText("Invoice Face Value"), {
      target: { value: "1000" },
    });
    fireEvent.change(screen.getByLabelText("Financing Discount Rate"), {
      target: { value: "0.5" },
    });

    expect(screen.getByLabelText("Invoice Face Value")).toHaveValue(1000);
    expect(screen.getByLabelText("Financing Discount Rate")).toHaveValue(0.5);
    expect(screen.getByText(/0.5% \(50 bps\)/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("995 USDC")).toBeInTheDocument();
      expect(screen.getAllByText("5 USDC")).toHaveLength(2);
    });
  });

  it("switches to the LP yield estimator and renders its inputs", () => {
    render(<DiscountCalculator />);

    fireEvent.click(screen.getByRole("button", { name: /LP Yield Estimator/i }));

    expect(screen.getByText(/LP Yield projection inputs/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Total USDC Deposit")).toHaveValue(10000);
    expect(screen.getByLabelText("Target Pool Utilization")).toHaveValue(80);
    expect(screen.getByLabelText("Avg Invoice Discount Bps")).toHaveValue(2);
    expect(screen.getByLabelText(/Average Days to Maturity/i)).toHaveValue(60);
    expect(screen.getByText(/Projected APY/i)).toBeInTheDocument();
    expect(screen.getByText(/Annual Earnings/i)).toBeInTheDocument();
  });
});
