import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { InvoiceStatus } from "./InvoiceStatus";

describe("InvoiceStatus", () => {
  it("renders correctly for created status", () => {
    render(<InvoiceStatus status="Created" />);
    expect(screen.getByText(/Created/i)).toBeInTheDocument();
  });

  it("renders correctly for listed status", () => {
    render(<InvoiceStatus status="Listed" />);
    expect(screen.getByText(/Listed/i)).toBeInTheDocument();
  });

  it("renders correctly for funded status", () => {
    render(<InvoiceStatus status="Funded" />);
    expect(screen.getByText(/Funded/i)).toBeInTheDocument();
  });

  it("renders correctly for shipped status", () => {
    render(<InvoiceStatus status="Funded" />);
    expect(screen.getByText(/Funded/i)).toBeInTheDocument();
  });

  it("renders correctly for delivered status", () => {
    render(<InvoiceStatus status="Confirmed" />);
    expect(screen.getByText(/Confirmed/i)).toBeInTheDocument();
  });

  it("renders correctly for repaid status", () => {
    render(<InvoiceStatus status="Repaid" />);
    expect(screen.getByText(/Repaid/i)).toBeInTheDocument();
  });
});
