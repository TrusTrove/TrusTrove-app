import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TopStatusBar } from "./TopStatusBar";
import { useRecentEvents } from "@/hooks/useEvents";

vi.mock("@/hooks/useEvents", () => ({
  useRecentEvents: vi.fn(),
}));

describe("TopStatusBar", () => {
  it("renders network indicator and placeholder ticker when there are no events", () => {
    vi.mocked(useRecentEvents).mockReturnValue({
      events: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<TopStatusBar />);

    expect(
      screen.getByText(/SOROBAN TESTNET — PROTOCOL V1\.0/i),
    ).toBeInTheDocument();

    const ticker = screen.getByLabelText("Recent network activity");
    expect(ticker).toBeInTheDocument();

    // Placeholder items are displayed until real events arrive
    expect(screen.getAllByText("Awaiting...").length).toBeGreaterThan(0);
    expect(screen.getAllByText("0 USDC").length).toBeGreaterThan(0);
  });

  it("formats real events into ticker items (amount, discount, sme, time)", () => {
    const now = Math.floor(Date.now() / 1000);
    vi.mocked(useRecentEvents).mockReturnValue({
      events: [
        {
          id: 1,
          event_id: "evt_1",
          contract_id: "contract_a",
          ledger: 100,
          ledger_closed_at: now - 30, // < 60s -> "just now"
          event_type: "InvoiceFunded",
          data: {
            funded_amount: "5000000000", // 500 USDC in stroops
            discount_bps: "200", // 2.0%
            buyer: "GBUVPV52BHUVTRPSTODIB3VJJMV4YQRA275QKDBI6OYHR5TRMBMFX7AC",
          },
        },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<TopStatusBar />);

    expect(screen.getAllByText("500 USDC").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2.0% discount").length).toBeGreaterThan(0);
    // time is rendered wrapped in parentheses: `(just now)`
    expect(screen.getAllByText("(just now)").length).toBeGreaterThan(0);
    // buyer sliced to first 8 chars
    expect(
      screen.getAllByText(/GBUVPV52\.\.\./).length,
    ).toBeGreaterThan(0);
  });

  it("formats older event times as hours/days ago", () => {
    const now = Math.floor(Date.now() / 1000);
    vi.mocked(useRecentEvents).mockReturnValue({
      events: [
        {
          id: 2,
          event_id: "evt_2",
          contract_id: "contract_b",
          ledger: 101,
          ledger_closed_at: now - 7200, // 2 hours ago
          event_type: "InvoiceCreated",
          data: {
            face_value: "1000000000", // 100 USDC
            issuer: "GCXQA4VOMO3LMYI6Z7A5LJ6P4NQ7JZ2UK4T6HFW6NYDB4VK5FVBXSCE2",
          },
        },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<TopStatusBar />);

    expect(screen.getAllByText("100 USDC").length).toBeGreaterThan(0);
    expect(screen.getAllByText("(2h ago)").length).toBeGreaterThan(0);
    // issuer sliced to first 8 chars
    expect(screen.getAllByText(/GCXQA4VO\.\.\./).length).toBeGreaterThan(0);
  });

  it("falls back to placeholder ticker when the hook reports an error", () => {
    vi.mocked(useRecentEvents).mockReturnValue({
      events: [],
      isLoading: false,
      error: new Error("Failed to fetch events"),
      refetch: vi.fn(),
    });

    render(<TopStatusBar />);

    expect(screen.getAllByText("Awaiting...").length).toBeGreaterThan(0);
    expect(screen.getAllByText("0 USDC").length).toBeGreaterThan(0);
  });

  it("toggles the ticker pause state when the pause/play button is clicked", () => {
    vi.mocked(useRecentEvents).mockReturnValue({
      events: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<TopStatusBar />);

    // Initially rendering a playing ticker, so the pause action is presented
    let toggle = screen.getByLabelText("Pause ticker");
    expect(toggle).toBeInTheDocument();

    fireEvent.click(toggle);

    // After clicking, the action becomes "Play ticker"
    toggle = screen.getByLabelText("Play ticker");
    expect(toggle).toBeInTheDocument();

    fireEvent.click(toggle);

    expect(screen.getByLabelText("Pause ticker")).toBeInTheDocument();
  });
});