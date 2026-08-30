import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DiscountCalculator } from "./DiscountCalculator";

describe("DiscountCalculator", () => {
  it("renders the default SME financing calculation", () => {
    const { container } = render(<DiscountCalculator />);

    expect(
      screen.getByRole("button", { name: "SME Financing Calculator" }),
    ).toBeInTheDocument();

    const faceValue = screen.getByRole("slider", {
      name: "Invoice Face Value",
    });

    expect(faceValue).toHaveValue("50000");
    expect(faceValue).toHaveAttribute("aria-valuemin", "1000");
    expect(faceValue).toHaveAttribute("aria-valuemax", "500000");
    expect(container).toHaveTextContent("50,000 USDC");
    expect(container).toHaveTextContent("49,000");
  });

  it("accepts the minimum and maximum invoice face values", () => {
    const { container } = render(<DiscountCalculator />);
    const faceValue = screen.getByRole("slider", {
      name: "Invoice Face Value",
    });

    fireEvent.change(faceValue, { target: { value: "1000" } });
    expect(faceValue).toHaveValue("1000");
    expect(faceValue).toHaveAttribute("aria-valuenow", "1000");
    expect(container).toHaveTextContent("1,000 USDC");

    fireEvent.change(faceValue, { target: { value: "500000" } });
    expect(faceValue).toHaveValue("500000");
    expect(faceValue).toHaveAttribute("aria-valuenow", "500000");
    expect(container).toHaveTextContent("500,000 USDC");
  });

  it("constrains an out-of-range face value without producing invalid output", () => {
    const { container } = render(<DiscountCalculator />);
    const faceValue = screen.getByRole("slider", {
      name: "Invoice Face Value",
    });

    fireEvent.change(faceValue, { target: { value: "0" } });

    expect(faceValue).toHaveValue("1000");
    expect(faceValue).toHaveAttribute("aria-valuenow", "1000");
    expect(container).not.toHaveTextContent("NaN");
  });

  it("switches to the LP yield estimator and displays its controls", () => {
    render(<DiscountCalculator />);

    fireEvent.click(screen.getByRole("button", { name: "LP Yield Estimator" }));

    expect(
      screen.queryByRole("slider", { name: "Invoice Face Value" }),
    ).not.toBeInTheDocument();

    const lpSliders = screen.getAllByRole("slider");
    expect(lpSliders).toHaveLength(4);
    expect(lpSliders.map((slider) => slider.getAttribute("value"))).toEqual([
      "10000",
      "80",
      "2",
      "60",
    ]);
  });
});
