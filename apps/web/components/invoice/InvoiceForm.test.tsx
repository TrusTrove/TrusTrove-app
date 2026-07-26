import { screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { InvoiceForm } from "./InvoiceForm";
import { renderWithProviders } from "@/test-utils/renderWithProviders";

vi.mock("@trusttrove/sdk", () => ({
  InvoiceClient: vi.fn(function () {
    return { simulateTransaction: vi.fn().mockResolvedValue({}) };
  }),
  PoolClient: vi.fn(function () {}),
}));

// Global mock for fetch to spy on endpoint requests
const fetchMock = vi.fn();
global.fetch = fetchMock;

describe("InvoiceForm Component Boundary Tests", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("renders the invoice form with expected labels and submit button", () => {
    renderWithProviders(<InvoiceForm />);

    expect(screen.getByText(/buyer wallet address/i)).toBeInTheDocument();
    expect(screen.getByText(/face value/i)).toBeInTheDocument();
    expect(screen.getByText(/due date/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /review financing terms/i }),
    ).toBeInTheDocument();
  });

  it("shows error for invalid buyer address on next step", async () => {
    renderWithProviders(<InvoiceForm />);

    // Enter invalid buyer address
    const buyerInput = screen.getByPlaceholderText(/stellar public key/i);
    fireEvent.change(buyerInput, { target: { value: "invalid-address" } });

    // Fill a valid future due date so the only failure is buyer validation
    const dateInput = document.querySelector(
      'input[type="date"]',
    ) as HTMLInputElement;
    expect(dateInput).toBeTruthy();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    fireEvent.change(dateInput, {
      target: { value: tomorrow.toISOString().split("T")[0] },
    });

    const faceValueInput = screen.getByPlaceholderText(/50,000\.00/i);
    fireEvent.change(faceValueInput, { target: { value: "1500" } });

    // Click the next step button
    fireEvent.click(
      screen.getByRole("button", { name: /review financing terms/i }),
    );

    // Should show validation error
    expect(screen.getByText(/valid stellar public key/i)).toBeInTheDocument();
  });
});
