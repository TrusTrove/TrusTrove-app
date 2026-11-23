import React from "react";
import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DiscountCalculator } from "./DiscountCalculator";

describe("DiscountCalculator", () => {
  it("renders happy path with SME calculator by default", () => {
    const { container } = render(<DiscountCalculator />);

    expect(
      screen.getByRole("tab", { name: "SME Financing Calculator" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Liquidity Provider Calculator" }),
    ).toBeInTheDocument();

    const faceValue = screen.getByRole("slider", {
      name: "Invoice Face Value",
    });
    expect(faceValue).toBeInTheDocument();
    expect(container).toHaveTextContent("SME Financing Calculator");
  });

  it("handles switching between SME and LP tabs (edge case / interaction)", () => {
    render(<DiscountCalculator />);

    const lpTab = screen.getByRole("tab", { name: "Liquidity Provider Calculator" });
    fireEvent.click(lpTab);

    expect(lpTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "SME Financing Calculator" })).toHaveAttribute(
      "aria-selected",
      "false"
    );
  });

  it("handles invalid or out-of-range inputs gracefully without throwing errors (error/boundary path)", () => {
    render(<DiscountCalculator />);

    const faceValue = screen.getByRole("slider", {
      name: "Invoice Face Value",
    });

    // Simulate out-of-range value input
    fireEvent.change(faceValue, { target: { value: "-5000" } });
    expect(faceValue).toBeInTheDocument();

    // Switch to LP tab and test invalid/edge inputs if present
    const lpTab = screen.getByRole(
      "tab",
      { name: "Liquidity Provider Calculator" },
    );
    fireEvent.click(lpTab);

    const lpDeposit = screen.getByRole("slider", {
      name: "Total USDC Deposit",
    });
    fireEvent.change(lpDeposit, { target: { value: "999999999" } });
    expect(lpDeposit).toBeInTheDocument();
  });
});
