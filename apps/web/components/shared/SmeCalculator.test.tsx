import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SmeCalculator } from "./SmeCalculator";

describe("SmeCalculator", () => {
  it("associates the Payment Due Terms label with its select (#1001)", () => {
    render(<SmeCalculator />);

    const paymentTerms = screen.getByLabelText("Payment Due Terms");

    expect(paymentTerms.tagName).toBe("SELECT");
    expect(paymentTerms).toHaveValue("60");

    fireEvent.change(paymentTerms, { target: { value: "90" } });
    expect(paymentTerms).toHaveValue("90");
  });

  it("gives each calculator instance a unique Payment Due Terms id", () => {
    render(
      <>
        <SmeCalculator />
        <SmeCalculator />
      </>,
    );

    const [first, second] = screen.getAllByLabelText("Payment Due Terms");

    expect(first.id).not.toBe("");
    expect(first.id).not.toBe(second.id);
  });
});
