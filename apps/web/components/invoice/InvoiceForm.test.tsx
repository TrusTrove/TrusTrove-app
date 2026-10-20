import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { InvoiceForm } from "./InvoiceForm";
import { renderWithProviders } from "@/test-utils/renderWithProviders";
import { InvoiceClient } from "@trusttrove/sdk";
import { useWalletStore } from "@/store/wallet";

vi.mock("@trusttrove/sdk", () => ({
  configureSDK: vi.fn(),
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

// Mock DatePicker to simplify testing. It forwards the same id/aria wiring the
// real trigger receives so the labelled-field assertions below exercise it.
vi.mock("@/components/ui/date-picker", () => ({
  DatePicker: ({
    value,
    onChange,
    id,
    "aria-describedby": ariaDescribedBy,
  }: {
    value?: string;
    onChange: (value: string) => void;
    id?: string;
    "aria-describedby"?: string;
  }) => (
    <input
      type="date"
      id={id}
      aria-describedby={ariaDescribedBy}
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

  it("renders the invoice form with labelled fields and submit button", () => {
    renderWithProviders(<InvoiceForm />);

    // Each of these controls is named by its <label>, not by a placeholder
    // (#998).
    expect(screen.getByLabelText(/buyer wallet address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^asset$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^due date$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^due date$/i)).toHaveAccessibleDescription(
      /select invoice maturity date/i,
    );
    expect(screen.getByText(/face value/i)).toBeInTheDocument();
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

  it("announces the inline submission error via role=alert (#1106)", async () => {
    renderWithProviders(<InvoiceForm />);

    const buyerInput = screen.getByPlaceholderText(/stellar public key/i);
    fireEvent.change(buyerInput, { target: { value: "invalid-address" } });

    const dateInput = screen.getByTestId("date-picker") as HTMLInputElement;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    fireEvent.change(dateInput, {
      target: { value: tomorrow.toISOString().split("T")[0] },
    });

    fireEvent.change(screen.getByPlaceholderText(/50,000\.00/i), {
      target: { value: "1500" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /review financing terms/i }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/valid stellar public key/i);
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

  // #1097: when createInvoice succeeds but the immediate listing fails, the
  // compensating rollback must PATCH /invoices/:id/status to mark the invoice
  // Cancelled instead of leaving it "pending listing" forever.
  it("cancels the created invoice when listing fails and produces no 404", async () => {
    act(() => {
      useWalletStore.getState().connect("G123", "testnet");
    });

    // Simulation succeeds, but listing (listForFinancing) fails.
    vi.mocked(InvoiceClient).mockImplementation(function () {
      return {
        simulateTransaction: vi.fn().mockResolvedValue({}),
        listForFinancing: vi
          .fn()
          .mockRejectedValue(new Error("listing failed")),
      };
    } as any);

    const invoiceId = "inv-123";
    const patchCalls: Array<{ url: string; init?: RequestInit }> = [];
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      patchCalls.push({ url, init });
      if (String(url).endsWith("/invoices") && init?.method === "POST") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            invoice_id: invoiceId,
            transaction_hash: "0xabcdef1234567890",
            status: "Created",
          }),
        };
      }
      if (String(url).includes(`/invoices/${invoiceId}/status`)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: invoiceId, status: "Cancelled" }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });

    renderWithProviders(<InvoiceForm />);

    // Step 1: fill the form and move to step 2.
    await act(async () => {
      const buyerInput = screen.getByPlaceholderText(/stellar public key/i);
      fireEvent.change(buyerInput, {
        target: {
          value: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
        },
      });
      const faceValueInput = screen.getByPlaceholderText(/50,000\.00/i);
      fireEvent.change(faceValueInput, { target: { value: "1500" } });
      const dateInput = screen.getByTestId("date-picker") as HTMLInputElement;
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 8);
      fireEvent.change(dateInput, {
        target: { value: nextWeek.toISOString().split("T")[0] },
      });
      fireEvent.click(
        screen.getByRole("button", { name: /review financing terms/i }),
      );
    });

    // Step 2: trigger creation (immediate list is on by default).
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /create invoice/i }));
    });

    // The rollback must call PATCH /invoices/:id/status (not a 404ing path).
    await waitFor(() => {
      expect(
        patchCalls.some(
          (c) =>
            String(c.url).includes(`/invoices/${invoiceId}/status`) &&
            c.init?.method === "PATCH",
        ),
      ).toBe(true);
    });

    const patchCall = patchCalls.find((c) =>
      String(c.url).includes(`/invoices/${invoiceId}/status`),
    );
    expect(patchCall).toBeDefined();
    expect(patchCall!.init!.method).toBe("PATCH");
    expect(JSON.parse(String(patchCall!.init!.body))).toEqual({
      status: "Cancelled",
    });

    // No 404 path was hit for the cleanup.
    expect(
      patchCalls.some((c) => String(c.url).includes("/api/invoices")),
    ).toBe(false);

    await waitFor(() => {
      expect(screen.getByText(/cancelled/i)).toBeInTheDocument();
    });
  });
});
