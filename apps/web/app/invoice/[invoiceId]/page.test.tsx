import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// #1118: `generateMetadata` fetched the invoice with `cache: "no-store"` and the
// page then handed nothing to the client, which fetched it again -- two
// round-trips and a guaranteed "Fetching invoice state from ledger..." flash on
// every view. These tests drive the server half: one fetch shared by metadata
// and render, and the payload forwarded to the client.

const INVOICE_ID =
  "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2";
const ISSUER = "GCXQ2E3F6V3J6X6L6X6L6X6L6X6L6X6L6X6L6X6L6X6L6X6L6X6L6X6L6";
const API_BASE = "http://localhost:8080";

const RAW_INVOICE = {
  id: INVOICE_ID,
  issuer: ISSUER,
  buyer: ISSUER,
  face_value: "10000000000",
  asset: "USDC",
  discount_bps: 200,
  funded_amount: "8000000000",
  due_date: 1735689600,
  status: "Funded",
  created_at: 1735603200,
  funded_at: 1735603200,
  shipped_at: null,
  issuer_confirmed: true,
  buyer_confirmed: false,
  repaid_at: null,
};

// The page module holds the request-scoped memo, so each test needs a fresh
// instance of it rather than a shared one.
async function loadPage() {
  vi.resetModules();
  return import("./page");
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => RAW_INVOICE,
  }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("/invoice/[invoiceId] server render", () => {
  // React's `cache()` only dedupes inside a real server render, so the
  // "one fetch, not two" claim is proven against a built `next start` (see the
  // PR evidence), not here. What this suite pins is the half the unit can see:
  // the page now hands the client the payload it already fetched.
  it("forwards the fetched invoice payload to the client", async () => {
    const page = await loadPage();

    const element = await page.default({ params: { invoiceId: INVOICE_ID } });

    expect(fetchMock.mock.calls[0][0]).toBe(
      `${API_BASE}/invoices/${INVOICE_ID}`,
    );
    expect((fetchMock.mock.calls[0][1] as RequestInit).cache).toBe("no-store");
    expect(element.props).toEqual(
      expect.objectContaining({
        invoiceId: INVOICE_ID,
        initialInvoice: RAW_INVOICE,
      }),
    );
  });

  it("resolves metadata from the same request shape", async () => {
    const page = await loadPage();

    await page.default({ params: { invoiceId: INVOICE_ID } });
    const metadata = await page.generateMetadata({
      params: { invoiceId: INVOICE_ID },
    });

    expect(metadata.title).toContain("TrusTrove Invoice");
    expect(metadata.description).toContain("Status: Funded");
    expect(metadata.openGraph).toBeTruthy();
  });

  it("hands the client nothing when the indexer has no such invoice", async () => {
    fetchMock.mockImplementation(async () => ({
      ok: false,
      status: 404,
      json: async () => ({}),
    }));
    const page = await loadPage();

    const element = await page.default({ params: { invoiceId: "missing" } });
    const metadata = await page.generateMetadata({
      params: { invoiceId: "missing" },
    });

    expect(element.props.initialInvoice).toBeUndefined();
    expect(metadata.title).toBe("TrusTrove Invoice");
  });

  it("does not forward a payload when the fetch itself fails", async () => {
    fetchMock.mockImplementation(async () => {
      throw new Error("indexer unreachable");
    });
    const page = await loadPage();

    const element = await page.default({ params: { invoiceId: INVOICE_ID } });

    expect(element.props.initialInvoice).toBeUndefined();
  });
});
