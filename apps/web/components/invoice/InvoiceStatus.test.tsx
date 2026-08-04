import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { InvoiceStatus } from "./InvoiceStatus";

describe("InvoiceStatus", () => {
  it("renders correctly for Created status", () => {
    render(<InvoiceStatus status="Created" />);
    expect(screen.getByText(/Created/i)).toBeInTheDocument();
  });

  it("renders correctly for Listed status", () => {
    render(<InvoiceStatus status="Listed" />);
    expect(screen.getByText(/Listed/i)).toBeInTheDocument();
  });

  it("renders correctly for Funded status", () => {
    render(<InvoiceStatus status="Funded" />);
    expect(screen.getByText(/Funded/i)).toBeInTheDocument();
  });

  it("renders correctly for Active status", () => {
    render(<InvoiceStatus status="Active" />);
    expect(screen.getByText(/Active/i)).toBeInTheDocument();
  });

  it("renders correctly for Confirmed status", () => {
    render(<InvoiceStatus status="Confirmed" />);
    expect(screen.getByText(/Confirmed/i)).toBeInTheDocument();
  });

  it("renders correctly for Repaid status", () => {
    render(<InvoiceStatus status="Repaid" />);
    expect(screen.getByText(/Repaid/i)).toBeInTheDocument();
  });

  it("renders correctly for Defaulted status", () => {
    render(<InvoiceStatus status="Defaulted" />);
    expect(screen.getByText(/Defaulted/i)).toBeInTheDocument();
  });
});
