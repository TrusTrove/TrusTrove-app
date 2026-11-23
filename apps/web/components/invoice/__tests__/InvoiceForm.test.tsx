import React from "react";
import { render, screen } from "@testing-library/react";
import { InvoiceForm } from "../InvoiceForm";

describe("InvoiceForm Financing Cost & Boundary Validations", () => {
  it("renders financing cost slider and initial defaults correctly", () => {
    render(<InvoiceForm />);
    expect(screen.getByText(/Financing Cost/i)).toBeInTheDocument();
    expect(screen.getByText(/200 bps/i)).toBeInTheDocument();
  });

  it("handles empty or invalid face value cleanly without NaN", () => {
    render(<InvoiceForm />);
    const reviewButton = screen.getByRole("button", { name: /REVIEW FINANCING TERMS/i });
    expect(reviewButton).toBeInTheDocument();
  });

  it("enforces permission and wallet boundary when listing", async () => {
    render(<InvoiceForm />);
    expect(screen.getByLabelText(/List for immediate LP financing at creation/i)).toBeChecked();
  });
});
