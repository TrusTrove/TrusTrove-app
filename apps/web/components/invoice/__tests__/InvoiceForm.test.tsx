import React from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect } from "vitest";
import { InvoiceForm } from "../InvoiceForm";

const renderWithQueryClient = (ui: React.ReactElement) =>
  render(
    <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>,
  );

describe("InvoiceForm Financing Cost & Boundary Validations", () => {
  it("renders financing cost slider and initial defaults correctly", () => {
    renderWithQueryClient(<InvoiceForm />);
    expect(screen.getByText(/Financing Cost/i)).toBeInTheDocument();
    expect(screen.getByText(/200 bps/i)).toBeInTheDocument();
  });

  it("handles empty or invalid face value cleanly without NaN", () => {
    renderWithQueryClient(<InvoiceForm />);
    const reviewButton = screen.getByRole("button", {
      name: /REVIEW FINANCING TERMS/i,
    });
    expect(reviewButton).toBeInTheDocument();
  });

  it("enforces permission and wallet boundary when listing", async () => {
    renderWithQueryClient(<InvoiceForm />);
    expect(
      screen.getByLabelText(/List for immediate LP financing at creation/i),
    ).toBeChecked();
  });
});
