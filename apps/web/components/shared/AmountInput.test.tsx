import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AmountInput } from './AmountInput';

const baseProps = {
  value: '1000',
  onChange: () => {},
  asset: 'USDC' as const,
};

describe('AmountInput', () => {
  it('renders an input with defaults when only required props are provided', () => {
    render(<AmountInput {...baseProps} />);

    const input = screen.getByRole('spinbutton');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'number');
    expect(input).toHaveAttribute('step', '0.0000001');
    expect(input).toHaveAttribute('min', '0');
    expect(input).toHaveAttribute('placeholder', '0.00');
    expect(input).toHaveValue(1000);
    expect(input).not.toBeDisabled();
    expect(input).not.toBeRequired();

    expect(screen.getByText('Amount (USDC)')).toBeInTheDocument();
    expect(screen.getAllByText('USDC').length).toBeGreaterThan(0);
    expect(screen.queryByText('1,000 USDC')).not.toBeInTheDocument();
  });

  it('reflects prop-driven overrides for label, placeholder, asset ticker, and input state', () => {
    render(
      <AmountInput
        value=""
        onChange={() => {}}
        asset="XLM"
        label="Invoice Amount"
        placeholder="0.0"
        disabled
        required
      />,
    );

    const input = screen.getByRole('spinbutton');
    expect(input).toBeDisabled();
    expect(input).toBeRequired();
    expect(input).toHaveAttribute('placeholder', '0.0');

    expect(screen.getByText('Invoice Amount')).toBeInTheDocument();
    expect(screen.getAllByText('XLM').length).toBeGreaterThan(0);
  });

  it('calls onChange with the entered value when the input changes', () => {
    const onChange = vi.fn();
    render(<AmountInput value="" onChange={onChange} asset="USDC" />);

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '123' } });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('123');
  });

  it('does not call onChange while disabled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AmountInput value="" onChange={onChange} asset="USDC" disabled />);

    await user.type(screen.getByRole('spinbutton'), '123');

    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows a styled preview only when showPreview is true and previewValue is provided', () => {
    const { rerender } = render(
      <AmountInput {...baseProps} value="1234.5" showPreview previewValue={1234.5} />,
    );

    expect(screen.getByText('1,234.5 USDC')).toBeInTheDocument();

    rerender(
      <AmountInput
        {...baseProps}
        value="1234.5"
        showPreview
        previewValue={1234.5}
        previewLabel="≈ $1,250.00"
      />,
    );
    expect(screen.getByText('≈ $1,250.00')).toBeInTheDocument();

    rerender(<AmountInput {...baseProps} value="1234.5" showPreview previewValue={undefined} />);
    expect(screen.queryByText('1,234.5 USDC')).not.toBeInTheDocument();
  });
});
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
