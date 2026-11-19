import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNotifications } from "./useNotifications";
import { notificationHistoryKey } from "@/lib/storage";

const STORAGE_KEY = notificationHistoryKey("addr1");

let mockEvents: any[] = [];
let mockInvoices: any[] = [];
let mockRole = "issuer";

vi.mock("./useEvents", () => ({
  useRecentEvents: vi.fn(() => ({ events: mockEvents })),
}));
vi.mock("./useInvoices", () => ({
  useInvoicesList: vi.fn(() => ({ invoices: mockInvoices })),
}));
vi.mock("@/store/wallet", () => ({
  // Honor the selector like the real Zustand store: returning a fresh object
  // for every selector call changes the hook's effect deps on every render.
  useWalletStore: vi.fn(
    (selector?: (state: { address: string; role: string }) => unknown) => {
      const state = { address: "addr1", role: mockRole };
      return selector ? selector(state) : state;
    },
  ),
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

  it("preserves saved read flags when merging new events", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: "1",
          type: "Invoice Created",
          invoiceId: "inv1",
          message: "saved",
          timestamp: 1000,
          read: true,
        },
      ]),
    );
    mockInvoices = [{ id: "inv1", issuer: "addr1" }];
    mockEvents = [
      {
        id: 1,
        event_type: "InvoiceCreated",
        data: { invoice_id: "inv1" },
        ledger_closed_at: 1000,
      },
    ];

    const { result } = renderHook(() => useNotifications());

    expect(result.current.notifications[0].read).toBe(true);
    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(persisted[0].read).toBe(true);
  });

  it("does not overwrite invalid JSON, so corrupt history can still be recovered", () => {
    const corrupt = "{not valid json";
    localStorage.setItem(STORAGE_KEY, corrupt);
    mockInvoices = [{ id: "inv1", issuer: "addr1" }];
    mockEvents = [
      {
        id: 1,
        event_type: "InvoiceCreated",
        data: { invoice_id: "inv1" },
        ledger_closed_at: 1000,
      },
    ];

    const { result } = renderHook(() => useNotifications());

    // Fresh events still render, but the raw corrupt value is left untouched.
    expect(result.current.notifications).toHaveLength(1);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(corrupt);

    act(() => {
      result.current.markAllAsRead();
    });

    expect(localStorage.getItem(STORAGE_KEY)).toBe(corrupt);
  });

  it("does not overwrite a non-array stored value or blank the visible list", () => {
    const storedObject = JSON.stringify({
      id: "1",
      type: "Invoice Created",
      read: true,
    });
    localStorage.setItem(STORAGE_KEY, storedObject);
    mockInvoices = [{ id: "inv1", issuer: "addr1" }];
    mockEvents = [
      {
        id: 1,
        event_type: "InvoiceCreated",
        data: { invoice_id: "inv1" },
        ledger_closed_at: 1000,
      },
    ];

    const { result } = renderHook(() => useNotifications());

    expect(result.current.notifications).toHaveLength(1);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(storedObject);
  });

  it("keeps valid read flags from a partially malformed array without rewriting it", () => {
    const partiallyCorrupt = JSON.stringify([
      {
        id: "1",
        type: "Invoice Created",
        invoiceId: "inv1",
        message: "saved",
        timestamp: 1000,
        read: true,
      },
      "not a notification",
    ]);
    localStorage.setItem(STORAGE_KEY, partiallyCorrupt);
    mockInvoices = [{ id: "inv1", issuer: "addr1" }];
    mockEvents = [
      {
        id: 1,
        event_type: "InvoiceCreated",
        data: { invoice_id: "inv1" },
        ledger_closed_at: 1000,
      },
    ];

    const { result } = renderHook(() => useNotifications());

    expect(result.current.notifications[0].read).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(partiallyCorrupt);
  });
});
