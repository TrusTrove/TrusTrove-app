import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DiscountCalculator } from "./DiscountCalculator";

describe("DiscountCalculator", () => {
  it("renders the default SME financing calculation", () => {
    render(<DiscountCalculator />);

    expect(
      screen.getByText(/SME Financing Calculator/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Invoice Face Value")).toHaveValue("50000");
    expect(screen.getByLabelText("Financing Discount Rate")).toHaveValue("2");
    expect(screen.getByText("49,000 USDC")).toBeInTheDocument();
    expect(screen.getAllByText("1,000 USDC").length).toBeGreaterThan(0);
  });

  it("switches to the LP yield estimator and renders its inputs", () => {
    render(<DiscountCalculator />);

    fireEvent.click(screen.getByRole("button", { name: /LP Yield Estimator/i }));

    expect(screen.getByText(/LP Yield projection inputs/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Total USDC Deposit")).toHaveValue("10000");
    expect(screen.getByLabelText("Target Pool Utilization")).toHaveValue("80");
    expect(screen.getByLabelText("Avg Invoice Discount Bps")).toHaveValue("2");
    expect(screen.getByLabelText("Avg Days to Maturity")).toHaveValue("60");
    expect(screen.getByText(/Estimated APR/i)).toBeInTheDocument();
    expect(screen.getByText(/Projected Annual Yield/i)).toBeInTheDocument();
  });

  it("shows disclaimer text", () => {
    render(<DiscountCalculator />);

    expect(screen.getByText(/TrusTrove charges what the market sets/)).toBeInTheDocument();
  });
});