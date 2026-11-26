import type { Invoice } from "./types/index.js";

/** One cursor-based page returned by an SDK iterator's page fetcher. */
export interface CursorPage<T> {
  items: readonly T[];
  nextCursor: string | null;
}

/**
 * Fetches one page. Pass the received cursor to the next request and forward
 * the optional signal to the underlying request so cancellation reaches it.
 */
export type CursorPageFetcher<T> = (
  cursor: string | undefined,
  signal?: AbortSignal,
) => Promise<CursorPage<T>>;

/** Normalized event shape returned by the indexer event API. */
export interface EventEntry {
  id: number;
  eventId: string;
  contractId: string;
  ledger: number;
  ledgerClosedAt: number;
  eventType: string;
  data: Record<string, unknown>;
  invoiceIssuer?: string;
}

export interface CursorIteratorOptions {
  signal?: AbortSignal;
}

async function* iteratePages<T>(
  fetchPage: CursorPageFetcher<T>,
  signal?: AbortSignal,
): AsyncGenerator<T> {
  let cursor: string | undefined;
  const requestedCursors = new Set<string>();

  while (true) {
    signal?.throwIfAborted();
    const page: unknown = await fetchPage(cursor, signal);
    signal?.throwIfAborted();

    if (
      typeof page !== "object" ||
      page === null ||
      Array.isArray(page) ||
      !("items" in page) ||
      !Array.isArray(page.items) ||
      !("nextCursor" in page) ||
      (page.nextCursor !== null &&
        (typeof page.nextCursor !== "string" || page.nextCursor.length === 0))
    ) {
      throw new TypeError("Cursor page response is malformed");
    }

    for (const item of page.items as T[]) {
      signal?.throwIfAborted();
      yield item;
    }

    if (page.nextCursor === null) return;
    if (requestedCursors.has(page.nextCursor)) {
      throw new TypeError(`Cursor page response repeated cursor "${page.nextCursor}"`);
    }
    requestedCursors.add(page.nextCursor);
    cursor = page.nextCursor;
  }
}

/**
 * Iterates typed invoices returned by a cursor-based page fetcher. Overlapping
 * pages are deduplicated by invoice ID.
 */
export async function* iterateInvoices(
  fetchPage: CursorPageFetcher<Invoice>,
  options: CursorIteratorOptions = {},
): AsyncGenerator<Invoice> {
  const seenIds = new Set<string>();
  for await (const invoice of iteratePages(fetchPage, options.signal)) {
    if (!invoice || typeof invoice.id !== "string" || invoice.id.length === 0) {
      throw new TypeError("Invoice page contains an item without a valid id");
    }
    if (seenIds.has(invoice.id)) continue;
    seenIds.add(invoice.id);
    yield invoice;
  }
}

/** Iterates typed indexed events returned by a cursor-based page fetcher. */
export async function* iterateEvents(
  fetchPage: CursorPageFetcher<EventEntry>,
  options: CursorIteratorOptions = {},
): AsyncGenerator<EventEntry> {
  yield* iteratePages(fetchPage, options.signal);
}
