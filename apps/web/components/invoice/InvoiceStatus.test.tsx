import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { InvoiceStatus } from "./InvoiceStatus";

describe("InvoiceStatus", () => {
  it("renders correctly for created status", () => {
    render(<InvoiceStatus status="created" />);
    expect(screen.getByText(/Created/i)).toBeInTheDocument();
  });

  it("renders correctly for listed status", () => {
    render(<InvoiceStatus status="listed" />);
    expect(screen.getByText(/Listed/i)).toBeInTheDocument();
  });

  it("renders correctly for funded status", () => {
    render(<InvoiceStatus status="funded" />);
    expect(screen.getByText(/Funded/i)).toBeInTheDocument();
  });

  it("renders correctly for shipped status", () => {
    render(<InvoiceStatus status="shipped" />);
    expect(screen.getByText(/Shipped/i)).toBeInTheDocument();
  });

  it("renders correctly for delivered status", () => {
    render(<InvoiceStatus status="delivered" />);
    expect(screen.getByText(/Delivered/i)).toBeInTheDocument();
  });

  it("renders correctly for repaid status", () => {
    render(<InvoiceStatus status="repaid" />);
    expect(screen.getByText(/Repaid/i)).toBeInTheDocument();
  });
});
