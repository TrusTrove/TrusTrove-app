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

  it("correctly displays discounted amount when face value changes to 100000", () => {
    const { container } = render(<DiscountCalculator />);
    const faceValue = screen.getByRole("slider", {
      name: "Invoice Face Value",
    });

    fireEvent.change(faceValue, { target: { value: "100000" } });

    // With default 2% discount: 100000 - (100000 * 0.02) = 98000
    expect(faceValue).toHaveValue("100000");
    expect(container).toHaveTextContent("100,000 USDC");
  });

  it("correctly displays discounted amount when discount rate changes to 5%", () => {
    const { container } = render(<DiscountCalculator />);
    const discountRate = screen.getByRole("slider", {
      name: "Financing Discount Rate",
    });

    fireEvent.change(discountRate, { target: { value: "5.0" } });

    // With 5% discount on 50000: 50000 - (50000 * 0.05) = 47500
    expect(parseFloat(discountRate.getAttribute("value")!)).toBeCloseTo(5.0, 1);
    expect(container).toHaveTextContent("50,000 USDC");
  });

  it("handles minimum discount rate boundary without throwing", () => {
    const { container } = render(<DiscountCalculator />);
    const discountRate = screen.getByRole("slider", {
      name: "Financing Discount Rate",
    });

    fireEvent.change(discountRate, { target: { value: "0.5" } });

    expect(discountRate).toHaveValue("0.5");
    expect(container).not.toHaveTextContent("NaN");
  });

  it("updates output when both face value and discount rate change", () => {
    const { container } = render(<DiscountCalculator />);
    const faceValue = screen.getByRole("slider", {
      name: "Invoice Face Value",
    });
    const discountRate = screen.getByRole("slider", {
      name: "Financing Discount Rate",
    });

    fireEvent.change(faceValue, { target: { value: "75000" } });
    fireEvent.change(discountRate, { target: { value: "3.5" } });

    // Verify inputs were updated and component didn't throw
    expect(faceValue).toHaveValue("75000");
    expect(discountRate).toHaveValue("3.5");
    expect(container).toHaveTextContent("75,000 USDC");
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

  it("LP tab displays default values without NaN or errors", () => {
    const { container } = render(<DiscountCalculator />);

    fireEvent.click(screen.getByRole("button", { name: "LP Yield Estimator" }));

    // Verify LP values are displayed and correct
    expect(container).toHaveTextContent("10,000 USDC");
    expect(container).toHaveTextContent("80%");
    expect(container).toHaveTextContent("2%");
    expect(container).toHaveTextContent("60");
    expect(container).not.toHaveTextContent("NaN");
  });
});
