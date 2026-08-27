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

vi.mock("@stellar/stellar-sdk", () => ({
  StrKey: {
    isValidEd25519PublicKey: vi.fn(
      (value: string) => typeof value === "string" && value.startsWith("G"),
    ),
  },
  xdr: { ScVal: { scvBytes: vi.fn() } },
  nativeToScVal: vi.fn(),
}));

// Mock DatePicker to simplify testing
vi.mock("@/components/ui/date-picker", () => ({
  DatePicker: ({
    value,
    onChange,
  }: {
    value?: string;
    onChange: (value: string) => void;
  }) => (
    <input
      type="date"
      data-testid="date-picker"
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
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
    expect(screen.getByText(/asset/i)).toBeInTheDocument();
    expect(
      screen.getByText(/select invoice maturity date/i),
    ).toBeInTheDocument();
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
    const dateInput = screen.getByTestId("date-picker") as HTMLInputElement;
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

    // Should show validation error for buyer address
    await waitFor(() => {
      expect(screen.getByText(/valid stellar public key/i)).toBeInTheDocument();
    });
  });

  it("rejects a due date less than 7 days from today", async () => {
    renderWithProviders(<InvoiceForm />);

    // Enter a valid buyer address
    const buyerInput = screen.getByPlaceholderText(/stellar public key/i);
    fireEvent.change(buyerInput, {
      target: {
        value: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      },
    });

    // Fill a valid face value
    const faceValueInput = screen.getByPlaceholderText(/50,000\.00/i);
    fireEvent.change(faceValueInput, { target: { value: "1500" } });

    // Set due date to 3 days from today (below the 7-day minimum)
    const dateInput = screen.getByTestId("date-picker") as HTMLInputElement;
    const threeDays = new Date();
    threeDays.setDate(threeDays.getDate() + 3);
    fireEvent.change(dateInput, {
      target: { value: threeDays.toISOString().split("T")[0] },
    });

    fireEvent.click(
      screen.getByRole("button", { name: /review financing terms/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/at least 7 days from today/i),
      ).toBeInTheDocument();
    });
  });

  it("rejects a due date more than 365 days from today", async () => {
    renderWithProviders(<InvoiceForm />);

    // Enter a valid buyer address
    const buyerInput = screen.getByPlaceholderText(/stellar public key/i);
    fireEvent.change(buyerInput, {
      target: {
        value: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      },
    });

    // Fill a valid face value
    const faceValueInput = screen.getByPlaceholderText(/50,000\.00/i);
    fireEvent.change(faceValueInput, { target: { value: "1500" } });

    // Set due date to 400 days from today (above the 365-day maximum)
    const dateInput = screen.getByTestId("date-picker") as HTMLInputElement;
    const fourHundredDays = new Date();
    fourHundredDays.setDate(fourHundredDays.getDate() + 400);
    fireEvent.change(dateInput, {
      target: { value: fourHundredDays.toISOString().split("T")[0] },
    });

    fireEvent.click(
      screen.getByRole("button", { name: /review financing terms/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/within 365 days from today/i),
      ).toBeInTheDocument();
    });
  });
});
