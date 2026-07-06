import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  apiFetch,
  fetchChallenge,
  verifyChallenge,
  createInvoice,
  getInvoiceByID,
  getInvoices,
  getPoolStats,
  getLPPosition,
  getRecentEvents,
  getPoolSnapshots,
  parseRawInvoice,
  parseRawPoolStats,
} from "./api";
import { useWalletStore } from "@/store/wallet";

let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockFetch = vi.fn();
  vi.stubGlobal("fetch", mockFetch);
  useWalletStore.getState().disconnect();
});

describe("apiFetch", () => {
  it("makes a GET request and returns JSON", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: "test" }),
    } as Response);

    const result = await apiFetch<{ data: string }>("/test");
    expect(result).toEqual({ data: "test" });
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8080/test",
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
  });

  it("injects Authorization header when token is present", async () => {
    useWalletStore.getState().setToken("my-token");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);

    await apiFetch("/test");

    const [, options] = mockFetch.mock.calls[0];
    expect((options.headers as Headers).get("Authorization")).toBe(
      "Bearer my-token",
    );
  });

  it("does not inject Authorization header when token is null", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);

    await apiFetch("/test");

    const [, options] = mockFetch.mock.calls[0];
    expect((options.headers as Headers).get("Authorization")).toBeNull();
  });

  it("sets Content-Type for POST requests", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);

    await apiFetch("/test", { method: "POST" });

    const [, options] = mockFetch.mock.calls[0];
    expect((options.headers as Headers).get("Content-Type")).toBe(
      "application/json",
    );
  });

  it("does not override existing Content-Type", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);

    await apiFetch("/test", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
    });

    const [, options] = mockFetch.mock.calls[0];
    expect((options.headers as Headers).get("Content-Type")).toBe("text/plain");
  });

  it("does not set Content-Type for GET requests", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);

    await apiFetch("/test", { method: "GET" });

    const [, options] = mockFetch.mock.calls[0];
    expect((options.headers as Headers).get("Content-Type")).toBeNull();
  });

  it("throws on 4xx response with error text", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => "Bad request",
    } as Response);

    await expect(apiFetch("/test")).rejects.toThrow("Bad request");
  });

  it("throws on 5xx response with empty body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "",
    } as Response);

    await expect(apiFetch("/test")).rejects.toThrow("HTTP error! status: 500");
  });

  it("re-throws network errors", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network failure"));

    await expect(apiFetch("/test")).rejects.toThrow("Network failure");
  });

  it("uses NEXT_PUBLIC_INDEXER_API_URL when set", async () => {
    process.env.NEXT_PUBLIC_INDEXER_API_URL = "https://api.example.com";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);

    await apiFetch("/test");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/test",
      expect.anything(),
    );
    delete process.env.NEXT_PUBLIC_INDEXER_API_URL;
  });
});

describe("parseRawInvoice", () => {
  it("converts snake_case API response to camelCase Invoice", () => {
    const raw = {
      id: "inv-1",
      issuer: "GABCDEF",
      buyer: "GHIJKL",
      face_value: "10000000",
      asset: "USDC",
      discount_bps: 500,
      funded_amount: "5000000",
      due_date: 1700000000,
      status: "Funded",
      created_at: 1690000000,
      funded_at: 1700100000,
      shipped_at: null,
      issuer_confirmed: true,
      buyer_confirmed: false,
      repaid_at: null,
      listed_at: 1695000000,
      issuer_confirmed_at: 1700200000,
      buyer_confirmed_at: null,
      defaulted_at: null,
      transaction_hashes: ["tx1", "tx2"],
      tx_hashes: ["tx1", "tx2"],
      created_tx_hash: "tx0",
      listed_tx_hash: "tx1",
      funded_tx_hash: "tx2",
      shipped_tx_hash: null,
      issuer_confirmed_tx_hash: "tx3",
      buyer_confirmed_tx_hash: null,
      repaid_tx_hash: null,
      defaulted_tx_hash: null,
    };

    const invoice = parseRawInvoice(raw);
    expect(invoice.id).toBe("inv-1");
    expect(invoice.issuer).toBe("GABCDEF");
    expect(invoice.buyer).toBe("GHIJKL");
    expect(invoice.faceValue).toBe(BigInt("10000000"));
    expect(invoice.asset).toBe("USDC");
    expect(invoice.discountBps).toBe(500);
    expect(invoice.fundedAmount).toBe(BigInt("5000000"));
    expect(invoice.dueDate).toBe(1700000000);
    expect(invoice.status).toBe("Funded");
    expect(invoice.createdAt).toBe(1690000000);
    expect(invoice.fundedAt).toBe(1700100000);
    expect(invoice.shippedAt).toBeNull();
    expect(invoice.issuerConfirmed).toBe(true);
    expect(invoice.buyerConfirmed).toBe(false);
    expect(invoice.repaidAt).toBeNull();
    expect(invoice.listedAt).toBe(1695000000);
    expect(invoice.issuerConfirmedAt).toBe(1700200000);
    expect(invoice.buyerConfirmedAt).toBeNull();
    expect(invoice.defaultedAt).toBeNull();
    expect(invoice.transactionHashes).toEqual(["tx1", "tx2"]);
    expect(invoice.txHashes).toEqual(["tx1", "tx2"]);
    expect(invoice.createdTxHash).toBe("tx0");
    expect(invoice.listedTxHash).toBe("tx1");
    expect(invoice.fundedTxHash).toBe("tx2");
    expect(invoice.shippedTxHash).toBeNull();
    expect(invoice.issuerConfirmedTxHash).toBe("tx3");
    expect(invoice.buyerConfirmedTxHash).toBeNull();
    expect(invoice.repaidTxHash).toBeNull();
    expect(invoice.defaultedTxHash).toBeNull();
  });

  it("defaults missing fields to safe values", () => {
    const invoice = parseRawInvoice({});

    expect(invoice.faceValue).toBe(BigInt(0));
    expect(invoice.asset).toBe("USDC");
    expect(invoice.discountBps).toBe(0);
    expect(invoice.fundedAmount).toBe(BigInt(0));
    expect(invoice.dueDate).toBe(0);
    expect(invoice.createdAt).toBe(0);
    expect(invoice.fundedAt).toBeNull();
    expect(invoice.shippedAt).toBeNull();
    expect(invoice.issuerConfirmed).toBe(false);
    expect(invoice.buyerConfirmed).toBe(false);
    expect(invoice.repaidAt).toBeNull();
  });

  it("handles XLM asset type", () => {
    const invoice = parseRawInvoice({ asset: "XLM" });
    expect(invoice.asset).toBe("XLM");
  });

  it("coerces truthy values for issuer_confirmed and buyer_confirmed", () => {
    const invoice = parseRawInvoice({
      issuer_confirmed: 1,
      buyer_confirmed: "yes",
    });
    expect(invoice.issuerConfirmed).toBe(true);
    expect(invoice.buyerConfirmed).toBe(true);
  });
});

describe("parseRawPoolStats", () => {
  it("converts raw pool stats correctly", () => {
    const raw = {
      total_deposits: "1000000000",
      total_funded: "500000000",
      available_liquidity: "500000000",
      utilization_rate_bps: 5000,
      total_yield_distributed: "10000000",
      active_invoice_count: 10,
    };

    const stats = parseRawPoolStats(raw);
    expect(stats.totalDeposits).toBe(BigInt("1000000000"));
    expect(stats.totalFunded).toBe(BigInt("500000000"));
    expect(stats.availableLiquidity).toBe(BigInt("500000000"));
    expect(stats.utilizationRateBps).toBe(5000);
    expect(stats.totalYieldDistributed).toBe(BigInt("10000000"));
    expect(stats.activeInvoiceCount).toBe(10);
  });

  it("defaults missing fields to zero", () => {
    const stats = parseRawPoolStats({});

    expect(stats.totalDeposits).toBe(BigInt(0));
    expect(stats.totalFunded).toBe(BigInt(0));
    expect(stats.availableLiquidity).toBe(BigInt(0));
    expect(stats.utilizationRateBps).toBe(0);
    expect(stats.totalYieldDistributed).toBe(BigInt(0));
    expect(stats.activeInvoiceCount).toBe(0);
  });

  it("handles explicitly null fields", () => {
    const stats = parseRawPoolStats({
      total_deposits: null,
      total_funded: null,
      available_liquidity: null,
      utilization_rate_bps: null,
      total_yield_distributed: null,
      active_invoice_count: null,
    });

    expect(stats.totalDeposits).toBe(BigInt(0));
    expect(stats.totalFunded).toBe(BigInt(0));
    expect(stats.availableLiquidity).toBe(BigInt(0));
    expect(stats.utilizationRateBps).toBe(0);
    expect(stats.totalYieldDistributed).toBe(BigInt(0));
    expect(stats.activeInvoiceCount).toBe(0);
  });

  it("handles empty string values", () => {
    const stats = parseRawPoolStats({
      total_deposits: "",
      total_funded: "",
      available_liquidity: "",
      total_yield_distributed: "",
    });

    expect(stats.totalDeposits).toBe(BigInt(0));
    expect(stats.totalFunded).toBe(BigInt(0));
    expect(stats.availableLiquidity).toBe(BigInt(0));
    expect(stats.totalYieldDistributed).toBe(BigInt(0));
    expect(stats.utilizationRateBps).toBe(0);
    expect(stats.activeInvoiceCount).toBe(0);
  });
});

describe("fetchChallenge", () => {
  it("fetches challenge for an address", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        transaction: "tx_blob",
        network_passphrase: "Test SDF Network ; September 2015",
      }),
    } as Response);

    const result = await fetchChallenge("GABCDEF");
    expect(result.transaction).toBe("tx_blob");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8080/auth?address=GABCDEF",
      expect.anything(),
    );
  });
});

describe("verifyChallenge", () => {
  it("sends transaction and returns token", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: "jwt-token" }),
    } as Response);

    const result = await verifyChallenge("signed_tx");
    expect(result.token).toBe("jwt-token");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8080/auth",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ transaction: "signed_tx" }),
      }),
    );
  });
});

describe("createInvoice", () => {
  it("sends invoice data and returns result", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        invoice_id: "inv-1",
        transaction_hash: "tx_hash",
        status: "Created",
      }),
    } as Response);

    const result = await createInvoice("GBUYER", "10000000", 1700000000);
    expect(result.invoice_id).toBe("inv-1");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8080/invoices",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          buyer: "GBUYER",
          face_value: "10000000",
          due_date: 1700000000,
          asset: "USDC",
        }),
      }),
    );
  });

  it("sends non-default asset type", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        invoice_id: "inv-2",
        transaction_hash: "tx_hash",
        status: "Created",
      }),
    } as Response);

    await createInvoice("GBUYER", "5000000", 1700000000, "XLM");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: JSON.stringify({
          buyer: "GBUYER",
          face_value: "5000000",
          due_date: 1700000000,
          asset: "XLM",
        }),
      }),
    );
  });
});

describe("getInvoiceByID", () => {
  it("fetches and parses an invoice by ID", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "inv-1",
        issuer: "GISS",
        buyer: "GBUY",
        face_value: "10000000",
        asset: "USDC",
        discount_bps: 500,
        funded_amount: "5000000",
        due_date: 1700000000,
        status: "Funded",
        created_at: 1690000000,
        funded_at: null,
        shipped_at: null,
        issuer_confirmed: false,
        buyer_confirmed: false,
        repaid_at: null,
      }),
    } as Response);

    const invoice = await getInvoiceByID("inv-1");
    expect(invoice.id).toBe("inv-1");
    expect(invoice.faceValue).toBe(BigInt("10000000"));
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8080/invoices/inv-1",
      expect.anything(),
    );
  });
});

describe("getInvoices", () => {
  const mockPaginatedResponse = {
    data: [
      {
        id: "inv-1",
        issuer: "GISS",
        buyer: "GBUY",
        face_value: "10000000",
        asset: "USDC",
        discount_bps: 500,
        funded_amount: "5000000",
        due_date: 1700000000,
        status: "Funded",
        created_at: 1690000000,
        funded_at: null,
        shipped_at: null,
        issuer_confirmed: false,
        buyer_confirmed: false,
        repaid_at: null,
      },
    ],
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
  };

  it("fetches invoices without filters", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPaginatedResponse,
    } as Response);

    const result = await getInvoices();
    expect(result.data).toHaveLength(1);
    expect(result.data[0].faceValue).toBe(BigInt("10000000"));
    expect(result.total).toBe(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8080/invoices",
      expect.anything(),
    );
  });

  it("appends query params when filters are provided", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPaginatedResponse,
    } as Response);

    await getInvoices({ status: "Funded", issuer: "GISS", page: 2, limit: 10 });
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8080/invoices?status=Funded&issuer=GISS&page=2&limit=10",
      expect.anything(),
    );
  });

  it("omits null/undefined filters", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPaginatedResponse,
    } as Response);

    await getInvoices({ status: "Created" });
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8080/invoices?status=Created",
      expect.anything(),
    );
  });

  it("returns empty data array when no invoices", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 }),
    } as Response);

    const result = await getInvoices();
    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
  });
});

describe("getPoolStats", () => {
  it("fetches and parses pool stats", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        total_deposits: "1000000000",
        total_funded: "500000000",
        available_liquidity: "500000000",
        utilization_rate_bps: 5000,
        total_yield_distributed: "10000000",
        active_invoice_count: 10,
      }),
    } as Response);

    const stats = await getPoolStats();
    expect(stats.totalDeposits).toBe(BigInt("1000000000"));
    expect(stats.utilizationRateBps).toBe(5000);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8080/pool/stats",
      expect.anything(),
    );
  });

  it("handles zero-value pool stats", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        total_deposits: "0",
        total_funded: "0",
        available_liquidity: "0",
        utilization_rate_bps: 0,
        total_yield_distributed: "0",
        active_invoice_count: 0,
      }),
    } as Response);

    const stats = await getPoolStats();
    expect(stats.totalDeposits).toBe(BigInt(0));
    expect(stats.activeInvoiceCount).toBe(0);
  });
});

describe("getLPPosition", () => {
  it("fetches and parses LP position for an address", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        shares: "1000",
        usdc_value: "500000000",
        yield_earned: "10000000",
        deposit_count: 3,
      }),
    } as Response);

    const position = await getLPPosition("GADDR");
    expect(position.shares).toBe(BigInt("1000"));
    expect(position.usdcValue).toBe(BigInt("500000000"));
    expect(position.yieldEarned).toBe(BigInt("10000000"));
    expect(position.depositCount).toBe(3);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8080/pool/position/GADDR",
      expect.anything(),
    );
  });
});

describe("getRecentEvents", () => {
  it("fetches events without limit", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: 1,
          event_id: "evt-1",
          contract_id: "contract-1",
          ledger: 100,
          ledger_closed_at: 1690000000,
          event_type: "InvoiceCreated",
          data: { invoice_id: "inv-1" },
        },
      ],
    } as Response);

    const events = await getRecentEvents();
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe("InvoiceCreated");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8080/events",
      expect.anything(),
    );
  });

  it("appends limit query param when provided", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);

    await getRecentEvents(5);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8080/events?limit=5",
      expect.anything(),
    );
  });
});

describe("getPoolSnapshots", () => {
  it("fetches pool snapshots", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          timestamp: 1690000000,
          utilizationRateBps: 5000,
          totalYieldDistributed: "10000000",
        },
      ],
    } as Response);

    const snapshots = await getPoolSnapshots();
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].utilizationRateBps).toBe(5000);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8080/pool/snapshots",
      expect.anything(),
    );
  });
});
