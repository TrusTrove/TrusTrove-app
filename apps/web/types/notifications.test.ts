import { describe, it, expect } from "vitest";
import { mapEventToNotification } from "./notifications";
import { EventLog } from "./index";

describe("mapEventToNotification", () => {
  const baseEvent: EventLog = {
    id: 1,
    event_id: "0001",
    contract_id: "C123",
    ledger: 1000,
    ledger_closed_at: 1680000000,
    event_type: "",
    data: {
      invoice_id: "inv123456",
    },
  };

  it("maps InvoiceCreated correctly", () => {
    const notif = mapEventToNotification({
      ...baseEvent,
      event_type: "InvoiceCreated",
    });
    expect(notif.type).toBe("Invoice Created");
    expect(notif.message).toBe("New invoice INV#inv1... issued on-chain");
    expect(notif.invoiceId).toBe("inv123456");
    expect(notif.id).toBe("1");
    expect(notif.read).toBe(false);
  });

  it("maps InvoiceFunded correctly", () => {
    const notif = mapEventToNotification({
      ...baseEvent,
      event_type: "InvoiceFunded",
    });
    expect(notif.type).toBe("Invoice Funded");
    expect(notif.message).toBe("INV#inv1... fully funded");
  });

  it("maps InvoiceListed correctly", () => {
    const notif = mapEventToNotification({
      ...baseEvent,
      event_type: "list_for_financing",
    });
    expect(notif.type).toBe("Invoice Listed");
    expect(notif.message).toBe("INV#inv1... listed for financing");
  });

  it("maps unknown event correctly", () => {
    const notif = mapEventToNotification({
      ...baseEvent,
      event_type: "UnknownEvent",
    });
    expect(notif.type).toBe("UnknownEvent");
    expect(notif.message).toBe("INV#inv1...");
  });

  it("maps empty invoice id correctly", () => {
    const notif = mapEventToNotification({
      ...baseEvent,
      event_type: "UnknownEvent",
      data: {},
    });
    expect(notif.type).toBe("UnknownEvent");
    expect(notif.message).toBe("Event occurred");
  });
});
