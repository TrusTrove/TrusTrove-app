import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { axe } from "vitest-axe";
import { AmountInput } from "./AmountInput";

describe("AmountInput accessibility", () => {
  it("has no axe violations (label association)", async () => {
    const { container } = render(
      <AmountInput
        value="100"
        onChange={() => {}}
        asset="USDC"
        label="Face Value"
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("label is programmatically associated with the input via htmlFor/id", () => {
    render(
      <AmountInput
        value="100"
        onChange={() => {}}
        asset="USDC"
        label="Face Value"
      />,
    );
    const label = screen.getByText("Face Value");
    expect(label).toHaveAttribute("for");
    const input = screen.getByPlaceholderText("0.00");
    expect(label.getAttribute("for")).toBe(input.getAttribute("id"));
  });

  it("label htmlFor matches input id for click-to-focus in real browsers", () => {
    render(
      <AmountInput
        value="100"
        onChange={() => {}}
        asset="USDC"
        label="Face Value"
      />,
    );
    const label = screen.getByText("Face Value");
    const input = screen.getByPlaceholderText("0.00");
    // Verify htmlFor is correctly set — jsdom doesn't fully simulate
    // label-click-to-focus, but correct htmlFor ensures the browser will.
    expect(label).toHaveAttribute("for", input.id);
    expect(input).toHaveAttribute("id");
  });

  it("multiple instances on the same page have unique label-input pairs", () => {
    render(
      <div>
        <AmountInput
          value="100"
          onChange={() => {}}
          asset="USDC"
          label="First Field"
        />
        <AmountInput
          value="200"
          onChange={() => {}}
          asset="USDC"
          label="Second Field"
        />
      </div>,
    );
    const firstLabel = screen.getByText("First Field");
    const secondLabel = screen.getByText("Second Field");
    // Get all inputs - both have the same placeholder
    const allInputs = screen.getAllByRole("textbox");
    expect(allInputs).toHaveLength(2);
    expect(firstLabel.getAttribute("for")).toBe(
      allInputs[0].getAttribute("id"),
    );
    expect(secondLabel.getAttribute("for")).toBe(
      allInputs[1].getAttribute("id"),
    );
    // Verify IDs are unique
    expect(allInputs[0].getAttribute("id")).not.toBe(
      allInputs[1].getAttribute("id"),
    );
  });
});
