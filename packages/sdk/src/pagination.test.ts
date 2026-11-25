import { describe, expect, it, vi } from "vitest";
import type { Invoice } from "./types/index.js";
import {
  EventEntry,
  iterateEvents,
  iterateInvoices,
} from "./pagination.js";

const invoice = (id: string) => ({ id }) as Invoice;

const event = (id: number): EventEntry => ({
  id,
  eventId: `event-${id}`,
  contractId: "CABC",
  ledger: id,
  ledgerClosedAt: id,
  eventType: "invoice_created",
  data: {},
});

async function collect<T>(items: AsyncIterable<T>): Promise<T[]> {
  const collected: T[] = [];
  for await (const item of items) collected.push(item);
  return collected;
}

describe("iterateInvoices", () => {
  it("follows cursors and does not repeat overlapping invoice IDs", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({
        items: [invoice("one"), invoice("two")],
        nextCursor: "cursor-2",
      })
      .mockResolvedValueOnce({
        items: [invoice("two"), invoice("three")],
        nextCursor: null,
      });

    const invoices = [];
    for await (const item of iterateInvoices(fetchPage)) invoices.push(item.id);

    expect(invoices).toEqual(["one", "two", "three"]);
    expect(fetchPage.mock.calls.map(([cursor]) => cursor)).toEqual([
      undefined,
      "cursor-2",
    ]);
  });

  it("returns no entries for an empty first page", async () => {
    const fetchPage = vi.fn().mockResolvedValue({
      items: [],
      nextCursor: null,
    });

    await expect(collect(iterateInvoices(fetchPage))).resolves.toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed or repeated cursors", async () => {
    const malformed = vi.fn().mockResolvedValue({ items: [] });
    await expect(collect(iterateInvoices(malformed))).rejects.toThrow(
      "Cursor page response is malformed",
    );

    const repeated = vi
      .fn()
      .mockResolvedValue({ items: [], nextCursor: "same-cursor" });
    await expect(collect(iterateInvoices(repeated))).rejects.toThrow(
      "repeated cursor",
    );
  });
});

describe("iterateEvents", () => {
  it("returns no entries when the first event page is empty", async () => {
    const fetchPage = vi.fn().mockResolvedValue({
      items: [],
      nextCursor: null,
    });

    await expect(collect(iterateEvents(fetchPage))).resolves.toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("yields typed events from multiple pages and forwards cancellation", async () => {
    const controller = new AbortController();
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({
        items: [event(1)],
        nextCursor: "next",
      })
      .mockResolvedValueOnce({
        items: [event(2)],
        nextCursor: null,
      });

    const entries = [];
    for await (const item of iterateEvents(fetchPage, {
      signal: controller.signal,
    })) {
      entries.push(item);
    }

    expect(entries).toEqual([event(1), event(2)]);
    expect(fetchPage.mock.calls.map(([cursor]) => cursor)).toEqual([
      undefined,
      "next",
    ]);
    expect(fetchPage.mock.calls.every(([, signal]) => signal === controller.signal))
      .toBe(true);
  });

  it("rejects malformed event cursor responses", async () => {
    const fetchPage = vi.fn().mockResolvedValue({
      items: [event(1)],
      nextCursor: "",
    });

    await expect(collect(iterateEvents(fetchPage))).rejects.toThrow(
      "Cursor page response is malformed",
    );
  });

  it("does not fetch when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchPage = vi.fn();

    await expect(
      collect(iterateEvents(fetchPage, { signal: controller.signal })),
    ).rejects.toThrow();
    expect(fetchPage).not.toHaveBeenCalled();
  });
});
