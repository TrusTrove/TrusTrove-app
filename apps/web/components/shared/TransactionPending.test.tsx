import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TransactionPending } from "./TransactionPending";

describe("TransactionPending", () => {
  it("renders loading state correctly", () => {
    render(
      <TransactionPending
        isOpen={true}
        txHash="0x123"
        statusText="Processing... Please wait"
      />,
    );
    expect(screen.getByText(/Processing... Please wait/i)).toBeInTheDocument();
    expect(screen.getByText(/TRANSACTION SIGNED/i)).toBeInTheDocument();
    expect(screen.getByText(/0x123/i)).toBeInTheDocument();
  });

  it("renders empty state correctly (not pending)", () => {
    const { container } = render(
      <TransactionPending isOpen={false} txHash={null} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
