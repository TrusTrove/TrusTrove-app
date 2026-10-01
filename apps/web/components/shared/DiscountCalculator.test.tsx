import React from "react";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DiscountCalculator } from "./DiscountCalculator";
import { useSmeDerivedValues } from "./SmeCalculator";
import { useLpDerivedValues } from "./LpCalculator";

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

describe("derived values are memoized (#662)", () => {
  it("does not recompute SME derived values when unrelated state changes", () => {
    const { result } = renderHook(() => {
      const [paymentTerms, setPaymentTerms] = React.useState(60);
      const derived = useSmeDerivedValues(50000, 2);
      return { paymentTerms, setPaymentTerms, derived };
    });

    const initial = result.current.derived;
    expect(initial).toEqual({ discountPaid: 1000, fundedAmount: 49000 });

    act(() => result.current.setPaymentTerms(90));

    expect(result.current.paymentTerms).toBe(90);
    expect(result.current.derived).toBe(initial);
  });

  it("recomputes SME derived values when a keyed input changes", () => {
    const { result, rerender } = renderHook(
      ({
        faceValue,
        discountRate,
      }: {
        faceValue: number;
        discountRate: number;
      }) => useSmeDerivedValues(faceValue, discountRate),
      { initialProps: { faceValue: 50000, discountRate: 2 } },
    );

    const initial = result.current;
    rerender({ faceValue: 50000, discountRate: 5 });

    expect(result.current).not.toBe(initial);
    expect(result.current.discountPaid).toBe(2500);
    expect(result.current.fundedAmount).toBe(47500);
  });

  it("does not recompute LP derived values when unrelated state changes", () => {
    const { result } = renderHook(() => {
      const [activeTab, setActiveTab] = React.useState("sme");
      const derived = useLpDerivedValues(10000, 80, 2, 60);
      return { activeTab, setActiveTab, derived };
    });

    const initial = result.current.derived;
    expect(initial.lpProjectedApy).toBeCloseTo(9.733, 2);
    expect(initial.lpAnnualEarnings).toBeCloseTo(973.33, 2);

    act(() => result.current.setActiveTab("lp"));

    expect(result.current.activeTab).toBe("lp");
    expect(result.current.derived).toBe(initial);
  });

  it("recomputes LP derived values when a keyed input changes", () => {
    const { result, rerender } = renderHook(
      ({
        lpDeposit,
        lpUtilization,
        lpAvgDiscount,
        lpAvgMaturity,
      }: {
        lpDeposit: number;
        lpUtilization: number;
        lpAvgDiscount: number;
        lpAvgMaturity: number;
      }) =>
        useLpDerivedValues(
          lpDeposit,
          lpUtilization,
          lpAvgDiscount,
          lpAvgMaturity,
        ),
      {
        initialProps: {
          lpDeposit: 10000,
          lpUtilization: 80,
          lpAvgDiscount: 2,
          lpAvgMaturity: 60,
        },
      },
    );

    const initial = result.current;
    rerender({
      lpDeposit: 10000,
      lpUtilization: 100,
      lpAvgDiscount: 2,
      lpAvgMaturity: 60,
    });

    expect(result.current).not.toBe(initial);
    expect(result.current.lpProjectedApy).toBeCloseTo(12.1667, 3);
    expect(result.current.lpAnnualEarnings).toBeCloseTo(1216.67, 2);
  });
});
