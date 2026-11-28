import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";
import {
  fetchChallenge,
  verifyChallenge,
  createInvoice,
  getInvoiceByID,
  getInvoices,
  getAllInvoices,
  getPoolStats,
  getLPPosition,
  getRecentEvents,
  getPoolSnapshots,
  parseRawPoolStats,
  parseRawLPPosition,
  apiClient,
  apiFetch,
  ApiError,
  isTransientApiError,
  DEFAULT_REQUEST_TIMEOUT_MS,
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

  describe("getAllInvoices", () => {
    const rawInvoice = (i: number) => ({
      id: `inv-${i}`,
      issuer: "GISSUE",
      buyer: "GBUY",
      face_value: "10000000",
      funded_amount: "0",
      status: "Created",
    });

    const pageResponse = (ids: number[], page: number, totalPages: number) => ({
      ok: true,
      json: () =>
        Promise.resolve({
          data: ids.map(rawInvoice),
          total: 250,
          page,
          limit: 100,
          totalPages,
        }),
    });

    it("should walk every server page to return the full unpaged set", async () => {
      mockFetch
        .mockResolvedValueOnce(
          pageResponse(
            Array.from({ length: 100 }, (_, i) => i),
            1,
            3,
          ),
        )
        .mockResolvedValueOnce(
          pageResponse(
            Array.from({ length: 100 }, (_, i) => 100 + i),
            2,
            3,
          ),
        )
        .mockResolvedValueOnce(
          pageResponse(
            Array.from({ length: 50 }, (_, i) => 200 + i),
            3,
            3,
          ),
        );

      const result = await getAllInvoices({ issuer: "GISSUE" });

      expect(result.length).toEqual(250);
      expect(result[0].id).toEqual("inv-0");
      expect(result[249].id).toEqual("inv-249");
      expect(mockFetch).toHaveBeenCalledTimes(3);

      const urls = mockFetch.mock.calls.map((call) => String(call[0]));
      expect(urls[0]).toContain("issuer=GISSUE");
      expect(urls[0]).toContain("page=1");
      expect(urls[1]).toContain("page=2");
      expect(urls[2]).toContain("page=3");
      // The API caps `limit` at 100, so full-set fetches must use that page size.
      for (const url of urls) {
        expect(url).toContain("limit=100");
      }
    });

    it("should return an empty array when there are no invoices", async () => {
      mockFetch.mockResolvedValueOnce(pageResponse([], 1, 1));

      const result = await getAllInvoices({ issuer: "GISSUE" });

      expect(result).toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should stop walking if the API returns an empty page mid-loop", async () => {
      // totalPages claims 3 but page 2 comes back empty — must not loop forever.
      mockFetch
        .mockResolvedValueOnce(pageResponse([0], 1, 3))
        .mockResolvedValueOnce(pageResponse([], 2, 3));

      const result = await getAllInvoices();

      expect(result.length).toEqual(1);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should deduplicate rows that shift between page requests", async () => {
      mockFetch
        .mockResolvedValueOnce(pageResponse([0, 1], 1, 2))
        // inv-1 was on page 1 before a newer row pushed it along.
        .mockResolvedValueOnce(pageResponse([1, 2], 2, 2));

      const result = await getAllInvoices({ issuer: "GISSUE" });

      expect(result.map((inv) => inv.id)).toEqual(["inv-0", "inv-1", "inv-2"]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
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

// ---------------------------------------------------------------------------
// Request timeouts, cancellation and bounded retry (issues #638 / #639).
// ---------------------------------------------------------------------------

/** Points the mocked wallet store at a token (or none) without using `any`. */
const setWalletToken = (token: string | null) => {
  (useWalletStore.getState as unknown as Mock).mockReturnValue({ token });
};

/** A successful JSON response, shaped like the parts of `Response` we use. */
const okResponse = (body: unknown = {}) => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(body),
});

/** A non-OK response with a plain-text body. */
const errorResponse = (status: number, text = "") => ({
  ok: false,
  status,
  text: () => Promise.resolve(text),
});

/** Makes `fetch` hang forever, ignoring its signal (a wedged backend). */
const hangForever = () => {
  mockFetch.mockImplementation(() => new Promise(() => {}));
};

/** Makes `fetch` hang until its signal aborts, like a real `fetch` does. */
const hangUntilAborted = () => {
  mockFetch.mockImplementation((_url: string, init?: RequestInit) => {
    return new Promise((_resolve, reject) => {
      const signal = init?.signal;
      if (!signal) return;
      signal.addEventListener("abort", () => {
        const abortError = new Error("The operation was aborted.");
        abortError.name = "AbortError";
        reject(abortError);
      });
    });
  });
};

describe("request timeout (#638)", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    setWalletToken(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects a hung request with a timeout error after the configured limit", async () => {
    vi.useFakeTimers();
    hangForever();

    // Retry is disabled here so the first timeout surfaces directly; the
    // retry of a timed-out GET is covered in the retry suite below.
    const captured = apiFetch("/stats", {
      timeoutMs: 5_000,
      retry: { attempts: 0 },
    }).catch((err: unknown) => err);

    await vi.advanceTimersByTimeAsync(4_999);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    const err = (await captured) as ApiError;

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.kind).toBe("timeout");
    expect(err.status).toBeNull();
    expect(err.path).toBe("/stats");
    // `classifyError` keys off the literal word "timeout".
    expect(err.message.toLowerCase()).toContain("timeout");
  });

  it("applies DEFAULT_REQUEST_TIMEOUT_MS when no override is given", async () => {
    vi.useFakeTimers();
    hangForever();

    const captured = apiFetch("/stats", { retry: { attempts: 0 } }).catch(
      (err: unknown) => err,
    );

    await vi.advanceTimersByTimeAsync(DEFAULT_REQUEST_TIMEOUT_MS - 1);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    const err = (await captured) as ApiError;
    expect(err.kind).toBe("timeout");
  });

  it("aborts the signal handed to fetch when the timeout fires", async () => {
    vi.useFakeTimers();
    hangUntilAborted();

    const captured = apiFetch("/stats", {
      timeoutMs: 1_000,
      retry: { attempts: 0 },
    }).catch((err: unknown) => err);
    await vi.advanceTimersByTimeAsync(1_000);

    const err = (await captured) as ApiError;
    expect(err.kind).toBe("timeout");
    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(init.signal?.aborted).toBe(true);
  });

  it("does not arm a timer when the timeout is disabled", async () => {
    vi.useFakeTimers();
    mockFetch.mockResolvedValueOnce(okResponse({ ok: true }));

    await apiFetch("/stats", { timeoutMs: 0 });

    expect(vi.getTimerCount()).toBe(0);
    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeUndefined();
  });

  it("clears the timeout timer on success, leaving no pending timers", async () => {
    vi.useFakeTimers();
    mockFetch.mockResolvedValueOnce(okResponse({ ok: true }));

    await apiFetch("/stats");

    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears the timeout timer when the request fails", async () => {
    vi.useFakeTimers();
    mockFetch.mockResolvedValueOnce(errorResponse(404, "Not Found"));

    await expect(apiFetch("/stats")).rejects.toThrow("Not Found");

    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("request cancellation (#638)", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    setWalletToken(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects with kind 'aborted' when the caller signal aborts mid-flight", async () => {
    hangUntilAborted();
    const controller = new AbortController();

    const captured = apiFetch("/stats", { signal: controller.signal }).catch(
      (err: unknown) => err,
    );
    controller.abort();
    const err = (await captured) as ApiError;

    expect(err).toBeInstanceOf(ApiError);
    expect(err.kind).toBe("aborted");
    expect(err.status).toBeNull();
    // A deliberate cancellation must not masquerade as a timeout…
    expect(err.message.toLowerCase()).not.toContain("timeout");
    // …nor as a server failure.
    expect(err.message).not.toContain("Service Temporarily Unavailable");
    expect(err.message).not.toContain("HTTP error!");
  });

  it("cancels the underlying fetch when the caller signal aborts", async () => {
    hangUntilAborted();
    const controller = new AbortController();

    const captured = apiFetch("/stats", { signal: controller.signal }).catch(
      (err: unknown) => err,
    );
    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.signal?.aborted).toBe(false);

    controller.abort();
    await captured;

    expect(init.signal?.aborted).toBe(true);
  });

  it("rejects immediately without calling fetch when the signal is already aborted", async () => {
    mockFetch.mockResolvedValue(okResponse({ ok: true }));
    const controller = new AbortController();
    controller.abort();

    const err = (await apiFetch("/stats", {
      signal: controller.signal,
    }).catch((caught: unknown) => caught)) as ApiError;

    expect(err).toBeInstanceOf(ApiError);
    expect(err.kind).toBe("aborted");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("removes every abort listener it installed on the caller signal", async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ ok: true }));
    const controller = new AbortController();
    const addSpy = vi.spyOn(controller.signal, "addEventListener");
    const removeSpy = vi.spyOn(controller.signal, "removeEventListener");

    await apiFetch("/stats", { signal: controller.signal });

    const added = addSpy.mock.calls.filter((call) => call[0] === "abort");
    const removed = removeSpy.mock.calls.filter((call) => call[0] === "abort");
    expect(added.length).toBeGreaterThan(0);
    expect(removed.length).toBe(added.length);

    const outstanding = new Set(added.map((call) => call[1]));
    for (const call of removed) outstanding.delete(call[1]);
    expect(outstanding.size).toBe(0);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("still distinguishes a caller abort when AbortSignal.any is unavailable", async () => {
    const holder = AbortSignal as unknown as {
      any?: (signals: AbortSignal[]) => AbortSignal;
    };
    const nativeAny = holder.any;
    delete holder.any;

    try {
      expect(holder.any).toBeUndefined();
      hangUntilAborted();
      const controller = new AbortController();

      const captured = apiFetch("/stats", {
        signal: controller.signal,
        timeoutMs: 60_000,
      }).catch((err: unknown) => err);
      const init = mockFetch.mock.calls[0][1] as RequestInit;
      controller.abort();
      const err = (await captured) as ApiError;

      expect(err.kind).toBe("aborted");
      expect(init.signal?.aborted).toBe(true);
    } finally {
      if (nativeAny) {
        Object.defineProperty(AbortSignal, "any", {
          value: nativeAny,
          writable: true,
          configurable: true,
          enumerable: false,
        });
      }
    }
  });

  it("preserves method, body, custom headers and auth while adding a signal", async () => {
    setWalletToken("test-token");
    mockFetch.mockResolvedValueOnce(okResponse({ ok: true }));
    const controller = new AbortController();
    const body = JSON.stringify({ transaction: "xdr" });

    await apiFetch("/auth", {
      method: "POST",
      body,
      headers: { "X-Custom-Header": "kept" },
      signal: controller.signal,
      timeoutMs: 5_000,
      retry: { attempts: 0 },
    });

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/auth");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(body);
    const headers = init.headers as Headers;
    expect(headers.get("X-Custom-Header")).toBe("kept");
    expect(headers.get("Authorization")).toBe("Bearer test-token");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    // TrusTrove-only options must never leak into the `fetch` init.
    expect(init).not.toHaveProperty("timeoutMs");
    expect(init).not.toHaveProperty("retry");
  });

  it("forwards a caller signal through the typed data functions", async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ total_deposits: "1" }));
    const controller = new AbortController();

    await getPoolStats({ signal: controller.signal });

    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.signal?.aborted).toBe(false);
  });

  it("forwards a caller signal to every page getAllInvoices walks", async () => {
    const page = (ids: string[], pageNumber: number, totalPages: number) =>
      okResponse({
        data: ids.map((id) => ({
          id,
          issuer: "GISSUE",
          buyer: "GBUY",
          face_value: "1",
        })),
        total: ids.length,
        page: pageNumber,
        limit: 100,
        totalPages,
      });
    mockFetch
      .mockResolvedValueOnce(page(["a"], 1, 2))
      .mockResolvedValueOnce(page(["b"], 2, 2));
    const controller = new AbortController();

    await getAllInvoices({ issuer: "GISSUE" }, { signal: controller.signal });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    for (const call of mockFetch.mock.calls) {
      const init = call[1] as RequestInit;
      expect(init.signal).toBeInstanceOf(AbortSignal);
    }
  });
});

describe("isTransientApiError (#639)", () => {
  it("is true for retry-worthy HTTP statuses", () => {
    for (const status of [429, 502, 503, 504]) {
      const err = new ApiError({
        kind: "http",
        status,
        path: "/stats",
        message: "boom",
      });
      expect(isTransientApiError(err)).toBe(true);
    }
  });

  it("is false for client and non-transient server errors", () => {
    for (const status of [400, 401, 403, 404, 409, 500]) {
      const err = new ApiError({
        kind: "http",
        status,
        path: "/stats",
        message: "boom",
      });
      expect(isTransientApiError(err)).toBe(false);
    }
  });

  it("is true for network and timeout failures", () => {
    expect(
      isTransientApiError(
        new ApiError({ kind: "network", path: "/stats", message: "boom" }),
      ),
    ).toBe(true);
    expect(
      isTransientApiError(
        new ApiError({ kind: "timeout", path: "/stats", message: "timeout" }),
      ),
    ).toBe(true);
  });

  it("is false for a caller cancellation", () => {
    expect(
      isTransientApiError(
        new ApiError({ kind: "aborted", path: "/stats", message: "cancelled" }),
      ),
    ).toBe(false);
  });

  it("is false for values that are not ApiErrors", () => {
    expect(isTransientApiError(new Error("boom"))).toBe(false);
    expect(isTransientApiError("boom")).toBe(false);
    expect(isTransientApiError(null)).toBe(false);
  });
});

describe("safe-method retry (#639)", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    setWalletToken(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retries a GET after a 503 and succeeds on the second attempt", async () => {
    mockFetch
      .mockResolvedValueOnce(errorResponse(503))
      .mockResolvedValueOnce(okResponse({ recovered: true }));

    const result = await apiFetch("/stats", { retry: { baseDelayMs: 0 } });

    expect(result).toEqual({ recovered: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("gives up after three attempts of consecutive 503s", async () => {
    mockFetch.mockResolvedValue(errorResponse(503));

    await expect(
      apiFetch("/stats", { retry: { baseDelayMs: 0 } }),
    ).rejects.toThrow(
      "Service Temporarily Unavailable. Please try again later.",
    );

    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("retries a network failure and a timeout on a GET", async () => {
    const networkFailure = new TypeError("Failed to fetch");
    mockFetch
      .mockRejectedValueOnce(networkFailure)
      .mockResolvedValueOnce(okResponse({ recovered: true }));

    const result = await apiFetch("/stats", { retry: { baseDelayMs: 0 } });

    expect(result).toEqual({ recovered: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-transient HTTP errors", async () => {
    for (const status of [400, 404]) {
      mockFetch.mockReset();
      mockFetch.mockResolvedValue(errorResponse(status, "nope"));

      await expect(
        apiFetch("/stats", { retry: { baseDelayMs: 0 } }),
      ).rejects.toThrow("nope");

      expect(mockFetch).toHaveBeenCalledTimes(1);
    }
  });

  // Financial safety: the indexer has no idempotency-key support and
  // `POST /invoices` creates an invoice, so a replay would duplicate it.
  it("never retries a POST that receives a 503", async () => {
    mockFetch.mockResolvedValue(errorResponse(503));

    await expect(
      apiFetch("/invoices", {
        method: "POST",
        body: JSON.stringify({ buyer: "GBUY" }),
        retry: { baseDelayMs: 0 },
      }),
    ).rejects.toThrow(
      "Service Temporarily Unavailable. Please try again later.",
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("never retries PUT, PATCH or DELETE on a 503", async () => {
    for (const method of ["PUT", "PATCH", "DELETE"]) {
      mockFetch.mockReset();
      mockFetch.mockResolvedValue(errorResponse(503));

      await expect(
        apiFetch("/invoices/1/status", {
          method,
          retry: { baseDelayMs: 0 },
        }),
      ).rejects.toThrow("Service Temporarily Unavailable");

      expect(mockFetch).toHaveBeenCalledTimes(1);
    }
  });

  it("honours a per-request retry budget of zero", async () => {
    mockFetch.mockResolvedValue(errorResponse(503));

    await expect(
      apiFetch("/stats", { retry: { attempts: 0 } }),
    ).rejects.toThrow("Service Temporarily Unavailable");

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("waits a deterministic exponential backoff between attempts", async () => {
    vi.useFakeTimers();
    mockFetch
      .mockResolvedValueOnce(errorResponse(503))
      .mockResolvedValueOnce(errorResponse(503))
      .mockResolvedValueOnce(okResponse({ recovered: true }));

    const pending = apiFetch("/stats", { retry: { baseDelayMs: 100 } });

    await vi.advanceTimersByTimeAsync(99);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(199);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(mockFetch).toHaveBeenCalledTimes(3);

    await expect(pending).resolves.toEqual({ recovered: true });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("retries a timed-out GET and succeeds on the next attempt", async () => {
    vi.useFakeTimers();
    mockFetch
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValueOnce(okResponse({ recovered: true }));

    const pending = apiFetch("/stats", {
      timeoutMs: 1_000,
      retry: { baseDelayMs: 0 },
    });

    await vi.advanceTimersByTimeAsync(1_000);

    await expect(pending).resolves.toEqual({ recovered: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("short-circuits the retry backoff when the caller cancels", async () => {
    vi.useFakeTimers();
    mockFetch.mockResolvedValue(errorResponse(503));
    const controller = new AbortController();

    const captured = apiFetch("/stats", {
      signal: controller.signal,
      retry: { baseDelayMs: 10_000 },
    }).catch((err: unknown) => err);

    await vi.advanceTimersByTimeAsync(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    controller.abort();
    await vi.advanceTimersByTimeAsync(0);
    const err = (await captured) as ApiError;

    expect(err).toBeInstanceOf(ApiError);
    expect(err.kind).toBe("aborted");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
