"use client";

import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DiscountCalculator } from "./DiscountCalculator";

describe("DiscountCalculator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders SME tab by default with correct initial values", () => {
    render(<DiscountCalculator />);

    expect(screen.getByText("SME Financing Calculator")).toBeInTheDocument();
    expect(screen.getByText("LP Yield Estimator")).toBeInTheDocument();
    expect(screen.getByLabelText("Invoice Face Value")).toHaveValue("50000");
    expect(screen.getByRole("combobox")).toHaveValue("60");
    expect(screen.getByLabelText("Financing Discount Rate")).toHaveValue("2");
  });

  it("switches to LP tab when clicked", () => {
    render(<DiscountCalculator />);

    fireEvent.click(screen.getByText("LP Yield Estimator"));

    expect(screen.getByText("LP Yield projection inputs")).toBeInTheDocument();
    expect(screen.getByLabelText("Total USDC Deposit")).toHaveValue("10000");
    expect(screen.getByLabelText("Target Pool Utilization")).toHaveValue("80");
    expect(screen.getByLabelText("Avg Invoice Discount Bps")).toHaveValue("2");
    expect(screen.getByLabelText("Avg Days to Maturity")).toHaveValue("60");
  });

  it("calculates discount correctly for SME tab with default values", () => {
    render(<DiscountCalculator />);

    const discountPaid = screen.getByText(/Discount paid:/).parentElement?.textContent;
    expect(discountPaid).toContain("1,000 USDC");

    const fundedAmount = screen.getByText(/You receive today:/).parentElement?.textContent;
    expect(fundedAmount).toContain("49,000 USDC");
  });

  it("updates payment terms when dropdown changes", () => {
    render(<DiscountCalculator />);

    const paymentTermsSelect = screen.getByRole("combobox");
    act(() => {
      fireEvent.change(paymentTermsSelect, { target: { value: "90" } });
    });

    expect(screen.getByText("90 Days")).toBeInTheDocument();
  });

  it("calculates LP projected APY correctly with default values", () => {
    render(<DiscountCalculator />);

    fireEvent.click(screen.getByText("LP Yield Estimator"));

    const apyText = screen.getByText(/Estimated APR:/).parentElement?.textContent;
    expect(apyText).toContain("9.73%");
  });

  it("updates LP calculations when utilization changes", () => {
    render(<DiscountCalculator />);

    fireEvent.click(screen.getByText("LP Yield Estimator"));

    const utilizationSlider = screen.getByLabelText("Target Pool Utilization");
    act(() => {
      fireEvent.input(utilizationSlider, { target: { value: "100" } });
    });

    const apyText = screen.getByText(/Estimated APR:/).parentElement?.textContent;
    expect(apyText).toContain("12.17%");
  });

  it("handles edge case: minimum LP maturity increases APY", () => {
    render(<DiscountCalculator />);

    fireEvent.click(screen.getByText("LP Yield Estimator"));

    const maturitySlider = screen.getByLabelText("Avg Days to Maturity");
    act(() => {
      fireEvent.input(maturitySlider, { target: { value: "15" } });
    });

    const apyText = screen.getByText(/Estimated APR:/).parentElement?.textContent;
    expect(apyText).toContain("38.93%");
  });

  it("shows disclaimer text", () => {
    render(<DiscountCalculator />);

    expect(screen.getByText(/TrusTrove charges what the market sets/)).toBeInTheDocument();
  });

  it("animates values when they change", async () => {
    render(<DiscountCalculator />);

    const faceValueSlider = screen.getByLabelText("Invoice Face Value");
    act(() => {
      fireEvent.input(faceValueSlider, { target: { value: "100000" } });
    });

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    const fundedAmount = screen.getByText(/You receive today:/).parentElement?.textContent;
    expect(fundedAmount).toContain("98,000 USDC");
  });

  it("renders both calculator sections with proper labels", () => {
    render(<DiscountCalculator />);

    expect(screen.getByText("Configure Invoice parameters")).toBeInTheDocument();
    expect(screen.getByText("Invoice Face Value")).toBeInTheDocument();
    expect(screen.getByText("Payment Due Terms")).toBeInTheDocument();
    expect(screen.getByText("Financing Discount Rate")).toBeInTheDocument();
  });

  it("renders LP section with proper labels", () => {
    render(<DiscountCalculator />);

    fireEvent.click(screen.getByText("LP Yield Estimator"));

    expect(screen.getByText("LP Yield projection inputs")).toBeInTheDocument();
    expect(screen.getByText("Total USDC Deposit")).toBeInTheDocument();
    expect(screen.getByText("Target Pool Utilization")).toBeInTheDocument();
    expect(screen.getByText("Avg Invoice Discount Bps")).toBeInTheDocument();
    expect(screen.getByText("Avg Days to Maturity")).toBeInTheDocument();
  });

  it("displays formula in LP output", () => {
    render(<DiscountCalculator />);

    fireEvent.click(screen.getByText("LP Yield Estimator"));

    expect(screen.getByText(/Formula: Utilization/)).toBeInTheDocument();
  });
});