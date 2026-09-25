import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNotifications } from "./useNotifications";

let mockEvents: any[] = [];
let mockInvoices: any[] = [];
let mockRole = "issuer";

vi.mock("./useEvents", () => ({
  useRecentEvents: vi.fn(() => ({ events: mockEvents })),
}));
vi.mock("./useInvoices", () => ({
  useInvoices: vi.fn(() => ({ invoices: mockInvoices })),
}));
vi.mock("@/store/wallet", () => ({
  useWalletStore: vi.fn(() => ({ address: "addr1", role: mockRole })),
}));

describe("useNotifications", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockEvents = [];
    mockInvoices = [];
    mockRole = "issuer";
  });

  it("filters out events for non-relevant invoices", () => {
    mockInvoices = [
      { id: "inv_mine", issuer: "addr1", buyer: "other" },
      { id: "inv_other", issuer: "other", buyer: "other" },
    ];
    mockEvents = [
      {
        id: 1,
        event_type: "InvoiceCreated",
        data: { invoice_id: "inv_mine" },
        ledger_closed_at: 1000,
      },
      {
        id: 2,
        event_type: "InvoiceCreated",
        data: { invoice_id: "inv_other" },
        ledger_closed_at: 1000,
      },
    ];

    const { result } = renderHook(() => useNotifications());

    expect(result.current.notifications.length).toBe(1);
    expect(result.current.notifications[0].invoiceId).toBe("inv_mine");
  });

  it("deduplicates events by id and preserves read status", () => {
    mockInvoices = [{ id: "inv1", issuer: "addr1" }];
    mockEvents = [
      {
        id: 1,
        event_type: "InvoiceCreated",
        data: { invoice_id: "inv1" },
        ledger_closed_at: 1000,
      },
    ];

    const { result, rerender } = renderHook(() => useNotifications());

    expect(result.current.notifications.length).toBe(1);

    act(() => {
      result.current.markAllAsRead();
    });

    expect(result.current.notifications[0].read).toBe(true);

    // Simulate polling where same event is returned
    rerender();

    expect(result.current.notifications.length).toBe(1);
    expect(result.current.notifications[0].read).toBe(true); // preserved!
  });
});
