import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { InvoiceFormLoader } from "./InvoiceFormLoader";

// #990: the dashboard's lazily imported invoice form fell back to a bare CSS
// spinner with no text at all.
describe("InvoiceFormLoader", () => {
  it("announces which form is loading", () => {
    render(<InvoiceFormLoader />);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Loading invoice form");
    expect(status).toHaveAttribute("aria-busy", "true");
  });

  it("hides the spinner graphic from the accessibility tree", () => {
    const { container } = render(<InvoiceFormLoader />);

    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toHaveAttribute("aria-hidden", "true");
  });
});
