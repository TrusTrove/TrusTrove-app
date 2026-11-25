import { afterEach, describe, expect, it, vi } from "vitest";
import {
  escapeCsvCell,
  exportInvoices,
  INVOICE_EXPORT_HEADERS,
  toInvoiceCsv,
  type IndexerInvoice,
} from "../src/commands/invoice-export.js";

const ISSUER = "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB";
const BUYER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const OTHER_BUYER =
  "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const API_URL = "http://localhost:8080";

const makeInvoice = (overrides: Partial<IndexerInvoice> = {}): IndexerInvoice => ({
  id: "a1".repeat(32),
  issuer: ISSUER,
  buyer: BUYER,
  face_value: "1000000000000000000000000000000",
  funded_amount: "900000000000000000000000000000",
  discount_bps: 500,
  due_date: 1_735_689_600,
  status: "Funded",
  created_at: 1_735_430_400,
  funded_at: null,
  shipped_at: null,
  repaid_at: null,
  ...overrides,
});

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function page(data: IndexerInvoice[], totalPages: number): Response {
  return jsonResponse({
    data,
    total: data.length,
    page: 1,
    limit: 100,
    totalPages,
  });
}

describe("escapeCsvCell", () => {
  it("keeps ordinary values unchanged", () => {
    expect(escapeCsvCell("Funded")).toBe("Funded");
    expect(escapeCsvCell(500)).toBe("500");
    expect(escapeCsvCell(null)).toBe("");
  });

  it("neutralizes formula prefixes with a leading apostrophe", () => {
    for (const value of ["=1+1", "+SUM(A1)", "-1", "@cmd", "\t=1"]) {
      expect(escapeCsvCell(value)).toBe(`'${value}`);
    }
  });

  it("quotes cells containing commas, quotes, or newlines", () => {
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell("line\nbreak")).toBe('"line\nbreak"');
  });
});

describe("toInvoiceCsv", () => {
  it("writes amounts exactly as the API returned them", () => {
    const invoice = makeInvoice();
    const csv = toInvoiceCsv([invoice]);
    const [header, row] = csv.split("\n");

    expect(header).toBe(INVOICE_EXPORT_HEADERS.join(","));
    // Full precision survives: no Number conversion, no exponent notation.
    expect(row).toContain(invoice.face_value);
    expect(row).toContain(invoice.funded_amount);
    expect(row).not.toContain("1e+");
  });

  it("escapes formula-shaped data cells, not just headers", () => {
    const csv = toInvoiceCsv([makeInvoice({ issuer: "=HYPERLINK(\"x\")" })]);

    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });

  it("emits only the header row for an empty result", () => {
    expect(toInvoiceCsv([])).toBe(INVOICE_EXPORT_HEADERS.join(","));
  });
});

describe("exportInvoices", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("follows every page and deduplicates rows by id", async () => {
    const first = makeInvoice({ id: "a1".repeat(32) });
    const second = makeInvoice({ id: "b2".repeat(32), status: "Repaid" });
    const duplicate = first;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(page([first], 2))
      .mockResolvedValueOnce(page([second, duplicate], 2));

    const result = await exportInvoices(
      { apiUrl: API_URL, status: "funded" },
      { fetch: fetchMock },
    );

    expect(result.pages).toBe(2);
    expect(result.invoices.map((invoice) => invoice.id)).toEqual([
      first.id,
      second.id,
    ]);

    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls[0]).toBe(
      `${API_URL}/invoices?page=1&limit=100&status=Funded`,
    );
    expect(urls[1]).toBe(
      `${API_URL}/invoices?page=2&limit=100&status=Funded`,
    );
    expect(result.csv.split("\n")).toHaveLength(3);
  });

  it("forwards issuer and status filters to the indexer", async () => {
    const fetchMock = vi.fn().mockResolvedValue(page([makeInvoice()], 1));

    await exportInvoices(
      { apiUrl: API_URL, issuer: ISSUER, status: "repaid" },
      { fetch: fetchMock },
    );

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get("issuer")).toBe(ISSUER);
    expect(url.searchParams.get("status")).toBe("Repaid");
    expect(url.searchParams.get("limit")).toBe("100");
  });

  it("applies the buyer filter across all pages", async () => {
    const mine = makeInvoice({ id: "a1".repeat(32), buyer: BUYER });
    const other = makeInvoice({ id: "b2".repeat(32), buyer: OTHER_BUYER });
    const laterMine = makeInvoice({ id: "c3".repeat(32), buyer: BUYER });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(page([mine, other], 2))
      .mockResolvedValueOnce(page([laterMine], 2));

    const result = await exportInvoices(
      { apiUrl: API_URL, buyer: BUYER },
      { fetch: fetchMock },
    );

    // The API has no buyer parameter, so both pages must still be read.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.invoices.map((invoice) => invoice.id)).toEqual([
      mine.id,
      laterMine.id,
    ]);
  });

  it("rejects an invalid filter before any request", async () => {
    const fetchMock = vi.fn();

    await expect(
      exportInvoices(
        { apiUrl: API_URL, issuer: "not-an-address" },
        { fetch: fetchMock },
      ),
    ).rejects.toThrow(/Invalid issuer address/);
    await expect(
      exportInvoices(
        { apiUrl: API_URL, status: "Nope" },
        { fetch: fetchMock },
      ),
    ).rejects.toThrow(/Unknown status "Nope"/);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an unknown status and reports indexer failures", async () => {
    await expect(
      exportInvoices(
        { apiUrl: API_URL, status: "Nope" },
        { fetch: vi.fn() },
      ),
    ).rejects.toThrow(/Unknown status "Nope"/);

    await expect(
      exportInvoices(
        { apiUrl: API_URL },
        { fetch: vi.fn().mockResolvedValue(new Response("boom", { status: 500 })) },
      ),
    ).rejects.toThrow(/returned HTTP 500/);
  });

  it("returns a header-only export when no invoice matches", async () => {
    const fetchMock = vi.fn().mockResolvedValue(page([], 1));

    const result = await exportInvoices(
      { apiUrl: API_URL, status: "Defaulted" },
      { fetch: fetchMock },
    );

    expect(result.invoices).toEqual([]);
    expect(result.csv).toBe(INVOICE_EXPORT_HEADERS.join(","));
  });
});
