import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { InvoiceFeed } from "./InvoiceFeed";
import { useRecentEvents } from "@/hooks/useEvents";

vi.mock("@/hooks/useEvents", () => ({
  useRecentEvents: vi.fn(),
}));

vi.mock("@/components/shared/SkeletonLoader", () => ({
  InvoiceFeedSkeleton: () => (
    <div data-testid="invoice-feed-skeleton">Loading...</div>
  ),
}));

describe("InvoiceFeed", () => {
  it("renders happy path events correctly", () => {
    const mockEvents = [
      {
        id: 1,
        event_id: "evt_1",
        contract_id: "contract_example",
        ledger: 100,
        event_type: "InvoiceCreated",
        ledger_closed_at: Math.floor(Date.now() / 1000) - 30, // less than 60s -> just now
        data: {
          invoice_id: "abcdef1234567890",
        },
      },
      {
        id: 2,
        event_id: "evt_2",
        contract_id: "contract_example",
        ledger: 101,
        event_type: "InvoiceFunded",
        ledger_closed_at: Math.floor(Date.now() / 1000) - 120, // 2 min ago
        data: {
          invoice_id: "0000001234567890",
        },
      },
    ] as any[]; // inline cast if typescript needs, or keep it typed correctly. Under types/index.ts. Let's make it fully correct.

    vi.mocked(useRecentEvents).mockReturnValue({
      events: mockEvents,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<InvoiceFeed />);

    expect(screen.getByText("Invoice Created")).toBeInTheDocument();
    expect(screen.getByText("Invoice Funded")).toBeInTheDocument();
    expect(screen.getByText("INV#abcdef…")).toBeInTheDocument();
    expect(screen.getByText("INV#000000…")).toBeInTheDocument();
    expect(screen.getByText("just now")).toBeInTheDocument();
    expect(screen.getByText("2 min ago")).toBeInTheDocument();
  });

  it("renders empty state edge case when no events exist", () => {
    vi.mocked(useRecentEvents).mockReturnValue({
      events: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<InvoiceFeed />);

    expect(screen.getByText("Awaiting on-chain activity")).toBeInTheDocument();
  });

  it("handles when data is loading", () => {
    vi.mocked(useRecentEvents).mockReturnValue({
      events: [],
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    render(<InvoiceFeed />);

    expect(screen.getByTestId("invoice-feed-skeleton")).toBeInTheDocument();
  });

  it("handles error path gracefully by displaying awaiting activity fallback", () => {
    // Error state in hook results in events being an empty list, with error populated.
    vi.mocked(useRecentEvents).mockReturnValue({
      events: [],
      isLoading: false,
      error: new Error("Failed to fetch events"),
      refetch: vi.fn(),
    });

    render(<InvoiceFeed />);

    expect(screen.getByText("Awaiting on-chain activity")).toBeInTheDocument();
  });
});

// #991: the feed needs region/list semantics and a polite status, not a flat run
// of divs.
describe("InvoiceFeed accessibility semantics", () => {
  const events = [
    {
      id: 1,
      event_id: "evt_1",
      contract_id: "contract_example",
      ledger: 100,
      event_type: "InvoiceFunded",
      ledger_closed_at: Math.floor(Date.now() / 1000) - 120,
      data: { invoice_id: "abcdef1234567890" },
    },
    {
      id: 2,
      event_id: "evt_2",
      contract_id: "contract_example",
      ledger: 101,
      event_type: "InvoiceCreated",
      ledger_closed_at: Math.floor(Date.now() / 1000) - 300,
      data: { invoice_id: "0000001234567890" },
    },
  ] as any[];

  it("names the container as a region through its heading", () => {
    vi.mocked(useRecentEvents).mockReturnValue({
      events,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<InvoiceFeed />);

    const region = screen.getByRole("region", { name: "Live Financing Feed" });
    expect(region).toBeInTheDocument();
    const heading = screen.getByRole("heading", {
      name: "Live Financing Feed",
    });
    expect(heading).toHaveProperty("tagName", "H2");
    expect(region.contains(heading)).toBe(true);
  });

  it("renders events as a list of list items", () => {
    vi.mocked(useRecentEvents).mockReturnValue({
      events,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<InvoiceFeed />);

    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(events.length);
  });

  it("announces the newest event and count in a polite status, not on the list", () => {
    vi.mocked(useRecentEvents).mockReturnValue({
      events,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<InvoiceFeed />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "2 recent events. Newest: Invoice Funded, 2 min ago.",
    );
    expect(screen.getByRole("list")).not.toHaveAttribute("aria-live");
  });

  it("exposes the empty state as status text", () => {
    vi.mocked(useRecentEvents).mockReturnValue({
      events: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<InvoiceFeed />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Awaiting on-chain activity",
    );
  });
});
