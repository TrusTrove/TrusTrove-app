import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchChallenge,
  verifyChallenge,
  createInvoice,
  getInvoiceByID,
  getInvoices,
  getPoolStats,
  getLPPosition,
  getRecentEvents,
  getPoolSnapshots,
  parseRawPoolStats,
  parseRawLPPosition,
  apiClient,
  isTransientHttpError,
  mutationRetryPolicy,
  apiFetch,
} from "./api";
import { useWalletStore } from "@/store/wallet";

// Mock useWalletStore
vi.mock("@/store/wallet", () => ({
  useWalletStore: {
    getState: vi.fn(),
  },
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("apiFetch internal function", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useWalletStore.getState as any).mockReturnValue({ token: null });
  });

  it("should add Authorization header when token exists", async () => {
    (useWalletStore.getState as any).mockReturnValue({ token: "test-token" });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await fetchChallenge("GTEST");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledHeaders = mockFetch.mock.calls[0][1].headers;
    expect(calledHeaders.has("Authorization")).toBe(true);
    expect(calledHeaders.get("Authorization")).toBe("Bearer test-token");
  });

  it("should not add Authorization header when no token exists", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await fetchChallenge("GTEST");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledHeaders = mockFetch.mock.calls[0][1].headers;
    expect(calledHeaders.has("Authorization")).toBe(false);
  });

  it("clears a stale token via clearToken when initApiClientWithToken runs with null store token", async () => {
    // Simulate a logged-in session that cached a JWT in the client.
    (useWalletStore.getState as any).mockReturnValue({ token: "stale-jwt" });
    initApiClientWithToken();
    apiClient.setToken("stale-jwt");

    // Logout path: the store token becomes null; the client must drop it too.
    (useWalletStore.getState as any).mockReturnValue({ token: null });
    initApiClientWithToken();

    expect((apiClient as any).token).toBeUndefined();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });
    await fetchChallenge("GTEST");

    const calledHeaders = mockFetch.mock.calls[0][1].headers;
    expect(calledHeaders.has("Authorization")).toBe(false);
  });

  it("should add Content-Type header for POST requests", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ token: "test" }),
    });

    await verifyChallenge("test-transaction");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledHeaders = mockFetch.mock.calls[0][1].headers;
    expect(calledHeaders.get("Content-Type")).toBe("application/json");
  });

  it("should throw an error when fetch response is not ok", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: () => Promise.resolve("Not Found"),
    });

    await expect(fetchChallenge("GTEST")).rejects.toThrow("Not Found");
  });

  it("should throw default error message when response is not ok and no text", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve(""),
    });

    await expect(fetchChallenge("GTEST")).rejects.toThrow(
      "HTTP error! status: 500",
    );
  });

  it("times out a hung request instead of hanging forever", async () => {
    vi.useFakeTimers();
    // A fetch that never resolves unless aborted.
    mockFetch.mockImplementationOnce(
      (_url: unknown, init: any) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new Error("aborted")),
          );
        }),
    );

    const promise = fetchChallenge("GTEST");

    // Advance past REQUEST_TIMEOUT_MS (20000).
    await vi.advanceTimersByTimeAsync(21000);

    await expect(promise).rejects.toThrow("aborted");
    vi.useRealTimers();
  });

  it("cancels an in-flight request when the caller's signal aborts", async () => {
    mockFetch.mockImplementationOnce(
      (_url: unknown, init: any) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new Error("cancelled")),
          );
        }),
    );

    const controller = new AbortController();
    const promise = apiFetch("/pool/stats", { signal: controller.signal });

    controller.abort();

    await expect(promise).rejects.toThrow("cancelled");
  });
});

describe("parseRawPoolStats", () => {
  it("should parse pool stats correctly", () => {
    const raw = {
      total_deposits: "1000000000000",
      total_funded: "500000000000",
      available_liquidity: "500000000000",
      utilization_rate_bps: 5000,
      total_yield_distributed: "10000000000",
      active_invoice_count: 10,
    };

    const result = parseRawPoolStats(raw);
    expect(result.totalDeposits).toEqual(BigInt("1000000000000"));
    expect(result.totalFunded).toEqual(BigInt("500000000000"));
    expect(result.availableLiquidity).toEqual(BigInt("500000000000"));
    expect(result.utilizationRateBps).toEqual(5000);
    expect(result.totalYieldDistributed).toEqual(BigInt("10000000000"));
    expect(result.activeInvoiceCount).toEqual(10);
  });
});

describe("parseRawLPPosition", () => {
  it("should parse LP position correctly", () => {
    const raw = {
      shares: "1000000000000",
      usdc_value: "1000000000000",
      yield_earned: "5000000000",
      deposit_count: 5,
    };

    const result = parseRawLPPosition(raw);
    expect(result.shares).toEqual(BigInt("1000000000000"));
    expect(result.usdcValue).toEqual(BigInt("1000000000000"));
    expect(result.yieldEarned).toEqual(BigInt("5000000000"));
    expect(result.depositCount).toEqual(5);
  });
});

describe("API functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useWalletStore.getState as any).mockReturnValue({ token: null });
  });

  describe("fetchChallenge", () => {
    it("should fetch challenge successfully", async () => {
      const mockResponse = {
        transaction: "test-tx",
        network_passphrase: "Test SDF Network ; September 2015",
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchChallenge("GTEST");
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/auth?address=GTEST"),
        expect.anything(),
      );
    });
  });

  describe("verifyChallenge", () => {
    it("should verify challenge successfully", async () => {
      const mockResponse = { token: "test-jwt" };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await verifyChallenge("test-tx-xdr");
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/auth"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("test-tx-xdr"),
        }),
      );
    });
  });

  describe("createInvoice", () => {
    it("should create invoice successfully", async () => {
      const mockResponse = {
        invoice_id: "test-invoice",
        transaction_hash: "test-hash",
        status: "CREATED",
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await createInvoice(
        "GBUYER",
        "1000000000",
        123456789,
        "USDC",
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe("getInvoiceByID", () => {
    it("should get invoice by id successfully", async () => {
      const rawInvoice = { id: "test-id", status: "CREATED" };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(rawInvoice),
      });

      const result = await getInvoiceByID("test-id");
      expect(result.id).toEqual("test-id");
    });
  });

  describe("getInvoices", () => {
    const emptyPage = {
      data: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    };

    it("should get invoices with filters", async () => {
      const rawInvoices = {
        data: [{ id: "1" }, { id: "2" }],
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(rawInvoices),
      });

      const result = await getInvoices({
        issuer: "GISSUE",
        status: "CREATED",
      });
      expect(result.total).toEqual(2);
      expect(result.data.length).toEqual(2);
    });

    it("should serialize every filter into the exact query string", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(emptyPage),
      });

      await getInvoices({
        status: "Funded",
        issuer: "GISSUE",
        page: 2,
        limit: 25,
      });

      expect(mockFetch.mock.calls[0][0]).toBe(
        "http://localhost:8080/invoices?status=Funded&issuer=GISSUE&page=2&limit=25",
      );
    });

    it("should not append a trailing question mark when there are no filters", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(emptyPage),
      });

      await getInvoices();

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toBe("http://localhost:8080/invoices");
      expect(url).not.toMatch(/\?$/);
    });

    it("should URL-encode filter values with special characters", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(emptyPage),
      });

      await getInvoices({
        status: "Funded & Active",
        issuer: "G/ABC?D",
      });

      expect(mockFetch.mock.calls[0][0]).toBe(
        "http://localhost:8080/invoices?status=Funded+%26+Active&issuer=G%2FABC%3FD",
      );
    });
  });

  describe("getPoolStats", () => {
    it("should get pool stats successfully", async () => {
      const rawStats = { total_deposits: "1000000000" };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(rawStats),
      });

      const result = await getPoolStats();
      expect(result.totalDeposits).toEqual(BigInt("1000000000"));
    });
  });

  describe("getLPPosition", () => {
    it("should get LP position successfully", async () => {
      const rawPosition = { shares: "1000000000" };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(rawPosition),
      });

      const result = await getLPPosition("GTEST");
      expect(result.shares).toEqual(BigInt("1000000000"));
    });
  });

  describe("getRecentEvents", () => {
    const mockEvents = [{ id: "1" }, { id: "2" }];

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockEvents),
      });
    });

    it("should get recent events successfully", async () => {
      const result = await getRecentEvents(10);
      expect(result.length).toEqual(2);
    });

    it("omits the query string when neither limit nor issuer is given", async () => {
      await getRecentEvents();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/events"),
        expect.anything(),
      );
      expect(mockFetch.mock.calls[0][0]).not.toContain("?");
    });

    it("sends limit only", async () => {
      await getRecentEvents(10);
      expect(mockFetch.mock.calls[0][0]).toContain("/events?limit=10");
    });

    // Issue #1115: the SME dashboard scopes its activity log server-side, so
    // the address must reach the indexer as a query parameter.
    it("sends the issuer scope", async () => {
      await getRecentEvents(undefined, "GABC123");
      expect(mockFetch.mock.calls[0][0]).toContain("/events?issuer=GABC123");
    });

    it("sends limit and issuer together", async () => {
      await getRecentEvents(10, "GABC123");
      expect(mockFetch.mock.calls[0][0]).toContain(
        "/events?limit=10&issuer=GABC123",
      );
    });
  });

  describe("getPoolSnapshots", () => {
    it("should get pool snapshots successfully", async () => {
      const mockSnapshots = [
        { id: "1", utilization_rate_bps: 5000 },
        { id: "2", utilization_rate_bps: 6000 },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSnapshots),
      });

      const result = await getPoolSnapshots();
      expect(result).toEqual(mockSnapshots);
    });
  });
});

describe("auth token source of truth (#1089)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });

  it("apiClient holds no token state of its own", () => {
    expect(apiClient).not.toHaveProperty("token");
    expect(apiClient).not.toHaveProperty("setToken");
  });

  it("apiFetch reads the wallet store token on every request", async () => {
    (useWalletStore.getState as any).mockReturnValue({ token: "first" });
    await apiFetch("/stats");
    expect(mockFetch.mock.calls[0][1].headers.get("Authorization")).toBe(
      "Bearer first",
    );

    (useWalletStore.getState as any).mockReturnValue({ token: "second" });
    await apiClient.fetch("/stats");
    expect(mockFetch.mock.calls[1][1].headers.get("Authorization")).toBe(
      "Bearer second",
    );

    (useWalletStore.getState as any).mockReturnValue({ token: null });
    await apiClient.fetch("/stats");
    expect(mockFetch.mock.calls[2][1].headers.has("Authorization")).toBe(false);
  });
});
